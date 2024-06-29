const { Octokit } = require('@octokit/rest');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { randomWords } = require('./config');
const { format } = require('date-fns');

async function createCsvFile(schedulePlan, accounts) {
    const header = ['Date', ...accounts.map(account => account.username)];
    const csvWriter = createCsvWriter({
        path: 'schedule_plan.csv',
        header: header.map(column => ({ id: column, title: column }))
    });

    const dates = Object.keys(schedulePlan);
    const records = dates.map(date => {
        const formattedDate = format(new Date(date), 'dd/MM');
        const record = { Date: formattedDate };
        accounts.forEach(account => {
            record[account.username] = schedulePlan[date][account.username] || 0;
        });
        return record;
    });

    await csvWriter.writeRecords(records);
}

async function createNewRepo(octokit, login, repos, randomWords) {
    let newRepoName;
    let attempts = 0;

    do {
        newRepoName = getRandomElement(randomWords);
        attempts++;
    } while (repos.find(r => r.name === newRepoName) && attempts < randomWords.length);

    if (attempts === randomWords.length) {
        throw new Error('Failed to find a unique repository name');
    }

    await octokit.rest.repos.createForAuthenticatedUser({
        name: newRepoName,
        private: false
    });

    return newRepoName;
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

async function checkFileExists(octokit, owner, repo, path) {
    try {
        await octokit.rest.repos.getContent({
            owner,
            repo,
            path
        });
        return true;
    } catch (error) {
        if (error.status === 404) {
            return false;
        } else {
            throw error;
        }
    }
}

module.exports = {
    createCsvFile,
    createNewRepo,
    getRandomElement,
    checkFileExists
};