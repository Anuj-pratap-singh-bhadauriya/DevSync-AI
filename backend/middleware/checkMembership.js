const prisma = require('../lib/prisma');

const checkMembership = async (req, res, next) => {
    try {
        const projectId = req.params.id;
        const userId = req.user.userId;

        if (!projectId) {
            return res.status(400).json({ error: "Project ID is required." });
        }

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: true }
        });

        if (!project) {
            return res.status(404).json({ error: "Workspace not found." });
        }

        const isOwner = project.ownerId === userId;
        const isMember = project.members.some(member => member.userId === userId);

        if (!isOwner && !isMember) {
            return res.status(403).json({ error: "Access denied. You are not a member of this workspace." });
        }

        next();
    } catch (error) {
        console.error("Authorization Error:", error);
        res.status(500).json({ error: "Server error during authorization check." });
    }
};

module.exports = checkMembership;
