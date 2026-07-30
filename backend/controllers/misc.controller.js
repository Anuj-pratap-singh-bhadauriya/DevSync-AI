exports.ping = (req, res) => res.json({ status: "Secure", timestamp: new Date() });

exports.turnCredentials = (req, res) => {
    res.json({
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.relay.metered.ca:80' },
            { urls: 'turn:global.relay.metered.ca:80', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
            { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
            { urls: 'turn:global.relay.metered.ca:443', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL },
            { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }
        ]
    });
};
