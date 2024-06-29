const schedule = require('node-schedule');
const { Octokit } = require('@octokit/rest');
const { getRandomElement, createCsvFile } = require('./utils');
const { TOTAL_DAYS, COMMITS_PER_ACCOUNT, REPOS_THRESHOLD, MAX_COMMITS_PER_DAY, accounts, codeSnippets, commitMessages, fileNames } = require('./config');
const { makeRandomCommit } = require('./commit');
const HttpsProxyAgent = require('https-proxy-agent');
const chalk = require('chalk');

const MAX_RETRIES = 10;
const RETRY_DELAY = 10000;

async function getCommitCount(octokit, username) {
    let totalCommits = 0;

    // Получение всех репозиториев пользователя
    const repos = await octokit.rest.repos.listForUser({ username });
    const commitPromises = repos.data.map(async (repo) => {
        try {
            const commits = await octokit.rest.repos.listCommits({ owner: username, repo: repo.name });
            return commits.data.length;
        } catch (error) {
            if (error.status === 409) {
                //console.log(`Repository ${repo.name} is empty.`);
                return 0;
            } else {
                throw error;
            }
        }
    });

    const commitCounts = await Promise.all(commitPromises);
    totalCommits = commitCounts.reduce((sum, count) => sum + count, 0);

    return totalCommits;
}

async function getAccountInfo(octokit, username) {
    const totalCommits = await getCommitCount(octokit, username);
    const { data } = await octokit.rest.users.getByUsername({ username });
    const creationDate = new Date(data.created_at);
    const now = new Date();
    const ageInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));
    return {
        totalCommits,
        creationDate: creationDate.toDateString(),
        ageInDays
    };
}

async function listReposWithRetry(octokit, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();
            return repos;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            //console.error(`Failed to list repositories (attempt ${attempt}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

async function scheduleRandomCommits() {
    let scheduledJobs = [];
    let schedulePlan = {};

    const accountPromises = accounts.map(async (account) => {
        let octokit;
        if (account.proxy) {
            const proxyAgent = new HttpsProxyAgent(account.proxy);
            octokit = new Octokit({
                auth: account.token,
                request: {
                    agent: proxyAgent
                }
            });
        } else {
            octokit = new Octokit({ auth: account.token });
        }

        const { data: { login } } = await octokit.rest.users.getAuthenticated();
        const accountInfo = await getAccountInfo(octokit, login);
        console.log(chalk.greenBright(`Account ${account.username}: Total commits: ${accountInfo.totalCommits}, Created: ${accountInfo.creationDate} (${accountInfo.ageInDays} days ago)`));

        let remainingCommits = COMMITS_PER_ACCOUNT - accountInfo.totalCommits;
        let dailyCommitPlan = Array(TOTAL_DAYS).fill(0);

        while (remainingCommits > 0) {
            const dayIndex = Math.floor(Math.random() * TOTAL_DAYS);
            if (dailyCommitPlan[dayIndex] < MAX_COMMITS_PER_DAY) {
                dailyCommitPlan[dayIndex]++;
                remainingCommits--;
            }
        }

        const commitPromises = dailyCommitPlan.map((commits, i) => {
            const promises = [];
            for (let j = 0; j < commits; j++) {
                const day = new Date();
                day.setDate(day.getDate() + i);
                day.setHours(0, 0, 0, 0); // Начало календарного дня
                const nextTime = new Date(day.getTime() + Math.random() * 86400000); // Случайное время в течение дня

                const codeSnippet = getRandomElement(codeSnippets);
                const commitMessage = getRandomElement(commitMessages);
                const fileName = getRandomElement(fileNames);

                promises.push(
                    listReposWithRetry(octokit)
                        .then(repos => {
                            const repoChoice = repos.length > 0 ? Math.floor(Math.random() * (repos.length + 1)) : 0;
                            const repoName = repoChoice === repos.length ? 'NEW_REPO' : repos[repoChoice].name;

                            scheduledJobs.push({ account: account.username, time: nextTime });

                            const dateKey = nextTime.toDateString();
                            if (!schedulePlan[dateKey]) {
                                schedulePlan[dateKey] = {};
                            }
                            schedulePlan[dateKey][account.username] = (schedulePlan[dateKey][account.username] || 0) + 1;

                            return schedule.scheduleJob(nextTime, async () => {
                                await makeRandomCommit(account, login, repoName, fileName, commitMessage, codeSnippet, nextTime);
                            });
                        })
                );
            }
            return Promise.all(promises);
        });

        await Promise.all(commitPromises);
    });

    await Promise.all(accountPromises);

    await createCsvFile(schedulePlan, accounts);

    console.log(`Scheduled commits over ${TOTAL_DAYS} days`);
}

module.exports = {
    scheduleRandomCommits
};