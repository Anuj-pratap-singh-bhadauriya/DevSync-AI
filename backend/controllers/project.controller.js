const prisma = require('../lib/prisma');
const { activeWorkspaces, roomUsers } = require('../store/memoryStore');

exports.create = async (req, res) => {
    try {
        const newProject = await prisma.project.create({ data: { title: req.body.title, description: req.body.description, ownerId: req.user.userId } });
        await prisma.workspaceMember.create({ data: { workspaceId: newProject.id, userId: req.user.userId, role: 'OWNER' } });
        res.status(201).json(newProject);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.list = async (req, res) => {
    try { res.json(await prisma.project.findMany({ where: { OR: [{ ownerId: req.user.userId }, { members: { some: { userId: req.user.userId } } }] } })); }
    catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.getById = async (req, res) => {
    try {
        const workspace = await prisma.project.findUnique({ where: { id: req.params.id }, include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } });
        if (!workspace) return res.status(404).json({ error: "Not found." });
        res.json(workspace);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.update = async (req, res) => {
    try { res.json(await prisma.project.update({ where: { id: req.params.id }, data: { title: req.body.title, description: req.body.description } })); }
    catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.remove = async (req, res) => {
    try {
        const projectId = req.params.id;
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) return res.status(404).json({ error: "Workspace not found." });
        if (project.ownerId !== req.user.userId) return res.status(401).json({ error: "Unauthorized. Only the owner can terminate this workspace." });
        await prisma.workspaceMember.deleteMany({ where: { workspaceId: projectId } });
        await prisma.project.delete({ where: { id: projectId } });

        // Clean up in-memory state and kick any connected sockets
        activeWorkspaces.delete(projectId);
        const io = req.app.get('io');
        if (roomUsers.has(projectId)) {
            roomUsers.get(projectId).forEach(({ socketId }) => {
                const s = io.sockets.sockets.get(socketId);
                if (s) s.emit('workspace-deleted', { message: "This workspace has been deleted by the owner." });
            });
            roomUsers.delete(projectId);
        }

        res.json({ message: "Workspace terminated successfully." });
    } catch (error) { res.status(500).json({ error: "Failed to terminate workspace." }); }
};

exports.removeMember = async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (project.ownerId !== req.user.userId && req.params.memberId !== req.user.userId) {
            return res.status(403).json({ error: "Unauthorized. Only the owner can remove members, or members can remove themselves." });
        }

        const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.memberId } }, include: { user: true } });
        if (!member) return res.status(404).json({ error: "Member not found." });
        if (member.role === 'OWNER') return res.status(400).json({ error: "Cannot remove the owner." });

        await prisma.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.memberId } } });
        const kickMessage = req.user.userId === req.params.memberId
            ? "You have left the workspace."
            : "You have been removed from the workspace by the owner.";

        // Kick them out if active
        const io = req.app.get('io');
        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === member.user.email) {
                s.emit('kicked-out', { message: kickMessage });
            }
        }
        res.json({ message: "Member removed." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};
