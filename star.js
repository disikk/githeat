const { Octokit } = require('@octokit/rest');
const axios = require('axios');
const HttpsProxyAgent = require('https-proxy-agent');

async function getRandomRepo() {
    const response = await axios.get('https://api.github.com/search/repositories', {
        params: {
            q: 'stars:>70', // Репозитории с более чем 100 звездами
            sort: 'stars',
            order: 'desc',
            per_page: 100,
            page: Math.floor(Math.random() * 20) + 1 // Случайная страница от 1 до 20
        },
        headers: {
            'Accept': 'application/vnd.github.v3+json'
        }
    });
  
    const repos = response.data.items;
    return repos[Math.floor(Math.random() * repos.length)];
}

async function starRepo(account, owner, repo) {
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
        await octokit.rest.activity.starRepoForAuthenticatedUser({
            owner,
            repo
        });
        console.log(`Account ${account.username}: Starred ${owner}/${repo}`);
    } catch (error) {
        console.error(`Account ${account.username}: Failed to star ${owner}/${repo}:`, error);
    }
}

module.exports = {
    getRandomRepo,
    starRepo
};