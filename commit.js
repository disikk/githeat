const { Octokit } = require('@octokit/rest');
const { checkFileExists, getRandomElement, createNewRepo } = require('./utils');
const { fileNames, randomWords, STAR_PROBABILITY } = require('./config');
const HttpsProxyAgent = require('https-proxy-agent');
const chalk = require('chalk');
const { getRandomRepo, starRepo } = require('./star');

const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

async function listReposWithRetry(octokit, retries = MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser();
            return repos;
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            console.error(`Failed to list repositories (attempt ${attempt}): ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        }
    }
}

async function getActiveDaysAndCommits(octokit, username) {
    let activeDays = new Set();
    let totalCommits = 0;

    // Получение всех репозиториев пользователя
    const repos = await octokit.rest.repos.listForUser({ username });
    const commitPromises = repos.data.map(async (repo) => {
        const commits = await octokit.rest.repos.listCommits({ owner: username, repo: repo.name });
        commits.data.forEach(commit => activeDays.add(new Date(commit.commit.author.date).toDateString()));
        return commits.data.length;
    });

    const commitCounts = await Promise.all(commitPromises);
    totalCommits = commitCounts.reduce((sum, count) => sum + count, 0);

    return {
        activeDays: activeDays.size,
        totalCommits
    };
}

async function getAccountCreationDate(octokit, username) {
    const { data } = await octokit.rest.users.getByUsername({ username });
    const creationDate = new Date(data.created_at);
    const now = new Date();
    const ageInDays = Math.floor((now - creationDate) / (1000 * 60 * 60 * 24));
    return {
        creationDate: creationDate.toDateString(),
        ageInDays
    };
}

async function makeRandomCommit(account, login, repoName, fileName, commitMessage, codeSnippet, nextTime) {
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

    try {
        const repos = await listReposWithRetry(octokit);

        if (repoName === 'NEW_REPO') {
            repoName = await createNewRepo(octokit, login, repos, randomWords);
            console.log(`Account ${account.username}: Created new repo ${repoName}`);
        }

        let fileExists = await checkFileExists(octokit, login, repoName, fileName);
        while (fileExists) {
            fileName = getRandomElement(fileNames);
            fileExists = await checkFileExists(octokit, login, repoName, fileName);
        }

        await octokit.rest.repos.createOrUpdateFileContents({
            owner: login,
            repo: repoName,
            path: fileName,
            message: commitMessage,
            content: Buffer.from(codeSnippet).toString('base64'),
        });

        console.log(chalk.greenBright(`Account ${account.username}: Committed to ${repoName} at ${nextTime}`));

        const { activeDays, totalCommits } = await getActiveDaysAndCommits(octokit, login);
        const { creationDate, ageInDays } = await getAccountCreationDate(octokit, login);
        console.log(chalk.greenBright(`Account ${account.username}: Active days: ${activeDays}, Total commits: ${totalCommits}, Created: ${creationDate} (${ageInDays} days ago)`));

        // С вероятностью 15% ставим звездочку случайному репозиторию
        if (Math.random() < STAR_PROBABILITY) {
            const repo = await getRandomRepo();
            await starRepo(account, repo.owner.login, repo.name);
        }
    }
    catch (error) {
        console.error(`Account ${account.username}: Failed to commit: ${error}`);
    }
}
        
module.exports = {
    makeRandomCommit
};