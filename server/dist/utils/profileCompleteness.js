export function computeCompleteness(user) {
    let score = 0;
    if (user.name)
        score += 10;
    if (user.bio && user.bio.length >= 20)
        score += 15;
    if (user.avatar_url)
        score += 10;
    if (user.year_of_study && user.branch)
        score += 10;
    if (user.looking_for && user.looking_for !== 'none')
        score += 10;
    if (user.skillCount >= 3)
        score += 15;
    if (user.interestCount >= 2)
        score += 10;
    if (user.workItemCount >= 1)
        score += 20;
    return Math.min(score, 100);
}
//# sourceMappingURL=profileCompleteness.js.map