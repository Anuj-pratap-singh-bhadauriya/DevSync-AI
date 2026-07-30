exports.getProblems = async (req, res) => {
    const limit = req.query.limit || 100;
    const query = `
        query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
            problemsetQuestionList: questionList(categorySlug: $categorySlug limit: $limit skip: $skip filters: $filters) {
                total: totalNum
                questions: data {
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                    acRate
                    topicTags { name slug }
                }
            }
        }
    `;
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
            body: JSON.stringify({ query, variables: { categorySlug: '', limit: parseInt(limit), skip: 0, filters: {} } })
        });
        const data = await response.json();
        res.json(data?.data?.problemsetQuestionList || { questions: [], total: 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch problems from LeetCode' });
    }
};

exports.getProblemDetail = async (req, res) => {
    const { titleSlug } = req.params;
    if (!/^[a-z0-9-]{1,100}$/.test(titleSlug)) {
        return res.status(400).json({ error: "Invalid problem slug." });
    }
    const query = `
        query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                questionFrontendId
                title
                content
                difficulty
                topicTags { name }
                stats
                hints
            }
        }
    `;
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://leetcode.com' },
            body: JSON.stringify({ query, variables: { titleSlug } })
        });
        const data = await response.json();
        const q = data?.data?.question;
        if (!q) return res.status(404).json({ error: 'Problem not found' });
        res.json({ question: q.content, title: q.title, difficulty: q.difficulty, topicTags: q.topicTags, hints: q.hints });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch problem from LeetCode' });
    }
};
