const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5000",
    "https://devsync-ai-kappa.vercel.app",
    /\.vercel\.app$/
];

const corsOptions = {
    origin: allowedOrigins,
    credentials: true
};

module.exports = { allowedOrigins, corsOptions };
