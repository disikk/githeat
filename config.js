const fs = require('fs');
const path = require('path');

module.exports = {
    TOTAL_DAYS: 90, // 3 месяца
    COMMITS_PER_ACCOUNT: 60,
    REPOS_THRESHOLD: 5,
    MAX_COMMITS_PER_DAY: 3, // Максимальное количество коммитов в день
    accounts: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'accounts.json'))),
    codeSnippets: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'code_snippets.json'))),
    randomWords: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'random_words.json'))),
    commitMessages: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'commit_messages.json'))),
    fileNames: JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'file_names.json')))
};