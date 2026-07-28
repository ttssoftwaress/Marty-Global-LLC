Fetch unresolved CodeRabbit threads on the PR for the current branch and fix them.

1. PR=$(gh pr list --head $(git branch --show-current) --state open --json number -q '.[0].number')
2. gh api graphql -f query='query($o:String!,$r:String!,$p:Int!){repository(owner:$o,name:$r){pullRequest(number:$p){reviewThreads(first:100){nodes{id isResolved path line comments(first:5){nodes{author{login} body}}}}}}}' -F o=OWNER -F r=REPO -F p=$PR
3. Keep only threads where isResolved=false and author is coderabbitai.
4. For each, use the "Prompt for AI Agents" block as the spec. Fix, then resolve
   the thread with the resolveReviewThread mutation.
5. Follow AGENTS.md. 
6. Do not Commit on your own.