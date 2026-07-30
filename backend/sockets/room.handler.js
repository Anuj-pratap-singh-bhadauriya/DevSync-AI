const prisma = require('../lib/prisma');
const { roomUsers, activeWorkspaces } = require('../store/memoryStore');

module.exports = (io, socket) => {
    socket.on('join-room', async (roomId, userEmail, userName) => {
        try {
            const project = await prisma.project.findUnique({
                where: { id: roomId },
                include: { members: true }
            });
            if (!project) return socket.emit('error', 'Workspace not found');

            const isOwner = project.ownerId === socket.user.userId;
            const isMember = project.members.some(m => m.userId === socket.user.userId);

            if (!isOwner && !isMember) {
                return socket.emit('error', 'Access denied to this workspace');
            }

            socket.join(roomId);
            socket.roomId = roomId;
            socket.userEmail = userEmail || 'Anonymous';
            socket.userName = userName || userEmail || 'Anonymous';

            // Track user in room
            if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Map());
            roomUsers.get(roomId).set(socket.id, { socketId: socket.id, email: socket.userEmail, name: socket.userName });

            // Ensure workspace state exists
            if (!activeWorkspaces.has(roomId)) {
                let initialFiles = [];
                try {
                    if (project.description && project.description.startsWith("[")) {
                        initialFiles = JSON.parse(project.description);
                    }
                } catch(e) {}
                if (initialFiles.length === 0) initialFiles = [{ name: "index.js", language: "javascript", content: "// DevSync Initialized" }];

                activeWorkspaces.set(roomId, {
                    files: initialFiles,
                    activeFileName: initialFiles[0]?.name || "index.js",
                    interviewEndTime: null,
                    videoParticipants: new Set(),
                    arenaProblem: null
                });
            }

            // Sync state to the newly joined user
            const currentState = activeWorkspaces.get(roomId);
            socket.emit('workspace-state-sync', {
                files: currentState.files,
                activeFileName: currentState.activeFileName,
                interviewEndTime: currentState.interviewEndTime,
                videoParticipants: Array.from(currentState.videoParticipants),
                arenaProblem: currentState.arenaProblem || null
            });

            // Broadcast updated user list
            io.to(roomId).emit('room-users-update', Array.from(roomUsers.get(roomId).values()));
            socket.to(roomId).emit('user-joined', { message: `A new collaborator has entered the workspace.` });
        } catch (error) {
            console.error("Socket join-room error:", error);
        }
    });

    socket.on('code-change', (data) => {
        const state = activeWorkspaces.get(data.roomId);
        if (state) {
            const file = state.files.find(f => f.name === data.fileName);
            if (file) file.content = data.code;
        }
        socket.to(data.roomId).emit('receive-code', { fileName: data.fileName, newContent: data.code });
    });

    socket.on('file-structure-change', (data) => {
        const state = activeWorkspaces.get(data.roomId);
        if (state) {
            state.files = data.files;
            state.activeFileName = data.activeFileName;
        }
        socket.to(data.roomId).emit('receive-file-structure', { files: data.files, activeFileName: data.activeFileName });
    });

    socket.on('arena-problem-sync', (data) => {
        const state = activeWorkspaces.get(data.roomId);
        if (state) state.arenaProblem = data.problem;
        socket.to(data.roomId).emit('arena-problem-sync', data.problem);
    });

    // --- Disconnect Handler ---
    socket.on('disconnect', async () => {
        const roomId = socket.roomId;
        if (roomId && roomUsers.has(roomId)) {
            const users = roomUsers.get(roomId);
            users.delete(socket.id);
            if (activeWorkspaces.has(roomId)) {
                activeWorkspaces.get(roomId).videoParticipants.delete(socket.id);
            }
            if (users.size === 0) {
                roomUsers.delete(roomId);

                // --- DB Auto-Save when last user disconnects ---
                const state = activeWorkspaces.get(roomId);
                if (state && state.files && state.files.length > 0) {
                    try {
                        await prisma.project.update({
                            where: { id: roomId },
                            data: { description: JSON.stringify(state.files) }
                        });
                        console.log(`Auto-saved workspace ${roomId} to database.`);
                    } catch (e) {
                        console.error(`Failed to auto-save workspace ${roomId}`, e);
                    }
                }
                // Only delete in-memory state if no new users joined during the async save
                if (!roomUsers.has(roomId)) {
                    activeWorkspaces.delete(roomId);
                }
            } else {
                io.to(roomId).emit('room-users-update', Array.from(users.values()));
            }
            // Notify others that this user left the call (if they were in one)
            socket.to(roomId).emit('call-user-left', { socketId: socket.id, email: socket.userEmail });
        }
    });
};
