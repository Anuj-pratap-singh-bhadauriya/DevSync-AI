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
        const member = project.members.find(m => m.userId === userId);

        if (!isOwner && !member) {
            return res.status(403).json({ error: "Access denied. You are not a member of this workspace." });
        }

        // Attach role to request for downstream use
        req.userRole = isOwner ? 'OWNER' : member.role;

        next();
    } catch (error) {
        console.error("Authorization Error:", error);
        res.status(500).json({ error: "Server error during authorization check." });
    }
};

module.exports = checkMembership;
