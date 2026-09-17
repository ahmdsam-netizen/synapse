import * as usersService from './users.service.js';
export async function getProfileHandler(req, res) {
    // @ts-ignore
    const viewerId = req.user?.id || null;
    const profile = await usersService.getProfile(viewerId, req.params.id);
    res.json({ data: profile });
}
export async function getMeHandler(req, res) {
    // @ts-ignore
    const profile = await usersService.getMe(req.user.id);
    res.json({ data: profile });
}
export async function updateProfileHandler(req, res) {
    // @ts-ignore
    const profile = await usersService.updateProfile(req.user.id, req.body);
    res.json({ data: profile });
}
export async function addSkillHandler(req, res) {
    // @ts-ignore
    const skill = await usersService.addSkill(req.user.id, {
        skillId: req.body.skillId,
        name: req.body.name,
        proficiency: req.body.proficiency
    });
    res.json({ data: skill });
}
export async function removeSkillHandler(req, res) {
    // @ts-ignore
    await usersService.removeSkill(req.user.id, req.params.skillId);
    res.status(204).send();
}
export async function addInterestHandler(req, res) {
    // @ts-ignore
    const interest = await usersService.addInterest(req.user.id, {
        interestId: req.body.interestId,
        name: req.body.name
    });
    res.json({ data: interest });
}
export async function removeInterestHandler(req, res) {
    // @ts-ignore
    await usersService.removeInterest(req.user.id, req.params.interestId);
    res.status(204).send();
}
export async function createWorkItemHandler(req, res) {
    // @ts-ignore
    const workItem = await usersService.createWorkItem(req.user.id, req.body);
    res.status(201).json({ data: workItem });
}
export async function updateWorkItemHandler(req, res) {
    // @ts-ignore
    const workItem = await usersService.updateWorkItem(req.user.id, req.params.id, req.body);
    res.json({ data: workItem });
}
export async function deleteWorkItemHandler(req, res) {
    // @ts-ignore
    await usersService.deleteWorkItem(req.user.id, req.params.id);
    res.status(204).send();
}
export async function searchSkillsHandler(req, res) {
    const q = req.query.q || '';
    const skills = await usersService.searchSkills(q);
    res.json({ data: skills });
}
export async function searchInterestsHandler(req, res) {
    const q = req.query.q || '';
    const interests = await usersService.searchInterests(q);
    res.json({ data: interests });
}
//# sourceMappingURL=users.controller.js.map