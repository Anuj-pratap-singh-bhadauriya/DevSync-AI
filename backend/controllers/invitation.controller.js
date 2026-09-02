const prisma = require('../lib/prisma');
const { emitToUserByEmail } = require('../utils/helpers');

exports.invite = async (req, res) => {
    try {
        const targetUser = await prisma.user.findUnique({ where: { email: req.body.targetEmail } });
        if (!targetUser) return res.status(404).json({ error: "User not found. They must have a DevSync account first." });
        if (targetUser.id === req.user.userId) return res.status(400).json({ error: "You cannot invite yourself." });

        // Only OWNER can invite as VIEWER; collaborators always invite as COLLABORATOR
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        const isOwner = project.ownerId === req.user.userId;
        const inviteStatus = isOwner ? 'PENDING' : 'REQUESTED_BY_COLLAB';

        // Role to assign on acceptance — only owner can set VIEWER
        const invitedRole = (isOwner && req.body.invitedRole === 'VIEWER') ? 'VIEWER' : 'COLLABORATOR';

        const existingMember = await prisma.workspaceMember.findUnique({
            where: { workspaceId_userId: { workspaceId: req.params.id, userId: targetUser.id } }
        });
        if (existingMember) return res.status(400).json({ error: "User is already a member of this workspace." });

        const existingInvite = await prisma.invitation.findUnique({
            where: { workspaceId_receiverId: { workspaceId: req.params.id, receiverId: targetUser.id } }
        });
        if (existingInvite && (existingInvite.status === 'PENDING' || existingInvite.status === 'REQUESTED_BY_COLLAB')) {
            return res.status(400).json({ error: "Invitation or request already pending for this user." });
        }

        if (existingInvite) await prisma.invitation.delete({ where: { id: existingInvite.id } });

        const invitation = await prisma.invitation.create({
            data: {
                workspaceId: req.params.id,
                senderId: req.user.userId,
                receiverId: targetUser.id,
                status: inviteStatus,
                invitedRole
            },
            include: { workspace: { select: { title: true } }, sender: { select: { name: true, email: true } }, receiver: { select: { name: true, email: true } } }
        });

        const io = req.app.get('io');
        if (isOwner) {
            emitToUserByEmail(io, targetUser.email, 'new-invitation', invitation);
            res.status(201).json({ message: "Invitation sent! Waiting for them to accept." });
        } else {
            io.to(req.params.id).emit('invite-approval-request', { ...invitation, ownerId: project.ownerId });
            res.status(201).json({ message: "Request sent to Owner for approval." });
        }
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: "Server error." });
    }
};


exports.getRequests = async (req, res) => {
    try {
        const project = await prisma.project.findUnique({ where: { id: req.params.id } });
        if (project.ownerId !== req.user.userId) return res.status(403).json({ error: "Unauthorized" });

        const requests = await prisma.invitation.findMany({
            where: { workspaceId: req.params.id, status: 'REQUESTED_BY_COLLAB' },
            include: { sender: { select: { name: true, email: true } }, receiver: { select: { name: true, email: true } } }
        });
        res.json(requests);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.approve = async (req, res) => {
    try {
        const invite = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { workspace: { include: { owner: true } }, receiver: true, sender: true } });
        if (!invite || invite.status !== 'REQUESTED_BY_COLLAB') return res.status(404).json({ error: "Request not found" });
        if (invite.workspace.ownerId !== req.user.userId) return res.status(403).json({ error: "Unauthorized" });

        const updated = await prisma.invitation.update({
            where: { id: req.params.id },
            data: { status: 'PENDING' },
            include: { workspace: { select: { title: true } }, sender: { select: { name: true, email: true } } }
        });

        const io = req.app.get('io');
        emitToUserByEmail(io, invite.receiver.email, 'new-invitation', updated);
        emitToUserByEmail(io, invite.sender.email, 'invite-decision', { status: 'ALLOWED', target: invite.receiver.name || invite.receiver.email, owner: invite.workspace.owner.name || "Owner" });

        res.json({ message: "Invite approved and sent." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.deny = async (req, res) => {
    try {
        const invite = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { workspace: { include: { owner: true } }, sender: true, receiver: true } });
        if (!invite || invite.status !== 'REQUESTED_BY_COLLAB') return res.status(404).json({ error: "Request not found" });
        if (invite.workspace.ownerId !== req.user.userId) return res.status(403).json({ error: "Unauthorized" });

        await prisma.invitation.delete({ where: { id: req.params.id } });

        const io = req.app.get('io');
        emitToUserByEmail(io, invite.sender.email, 'invite-decision', { status: 'DENIED', target: invite.receiver.name || invite.receiver.email, owner: invite.workspace.owner.name || "Owner" });

        res.json({ message: "Invite request denied." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.listPending = async (req, res) => {
    try {
        const invitations = await prisma.invitation.findMany({
            where: { receiverId: req.user.userId, status: 'PENDING' },
            include: {
                workspace: { select: { id: true, title: true } },
                sender: { select: { name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(invitations);
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.accept = async (req, res) => {
    try {
        const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { sender: true, workspace: { include: { owner: true } }, receiver: true } });
        if (!invitation || invitation.receiverId !== req.user.userId) return res.status(404).json({ error: "Invitation not found." });
        if (invitation.status !== 'PENDING') return res.status(400).json({ error: "Invitation already processed." });

        await prisma.workspaceMember.create({
            data: { workspaceId: invitation.workspaceId, userId: req.user.userId, role: invitation.invitedRole || 'COLLABORATOR' }
        });

        await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'ACCEPTED' } });

        const newMember = {
            id: 'temp-' + Date.now(),
            userId: invitation.receiver.id,
            workspaceId: invitation.workspaceId,
            role: invitation.invitedRole || 'COLLABORATOR',
            user: { id: invitation.receiver.id, name: invitation.receiver.name, email: invitation.receiver.email }
        };

        const io = req.app.get('io');
        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === invitation.sender.email || s.userEmail === invitation.workspace.owner.email) {
                s.emit('invite-response', { status: 'ACCEPTED', user: invitation.receiver.name || invitation.receiver.email, newMember });
            }
        }

        res.json({ message: "Invitation accepted! Workspace added to your dashboard." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};

exports.reject = async (req, res) => {
    try {
        const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id }, include: { sender: true, workspace: { include: { owner: true } }, receiver: true } });
        if (!invitation || invitation.receiverId !== req.user.userId) return res.status(404).json({ error: "Invitation not found." });

        await prisma.invitation.update({ where: { id: req.params.id }, data: { status: 'REJECTED' } });

        const io = req.app.get('io');
        const allSockets = io.sockets.sockets;
        for (const [, s] of allSockets) {
            if (s.userEmail === invitation.sender.email || s.userEmail === invitation.workspace.owner.email) {
                s.emit('invite-response', { status: 'REJECTED', user: invitation.receiver.name || invitation.receiver.email });
            }
        }

        res.json({ message: "Invitation rejected." });
    } catch (error) { res.status(500).json({ error: "Server error." }); }
};
