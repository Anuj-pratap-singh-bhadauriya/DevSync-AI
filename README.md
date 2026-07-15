<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0b1120&height=200&section=header&text=DevSync%20AI&fontSize=70&fontAlignY=35&desc=Real-Time%20Collaborative%20IDE%20%26%20AI-Powered%20Coding%20Platform&descAlignY=55&descAlign=50" alt="DevSync AI Banner" />
</div>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/Features-Explore-blue?style=for-the-badge&logo=rocket" alt="Features"></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Tech_Stack-MERN_%2B_WebRTC-purple?style=for-the-badge&logo=react" alt="Tech Stack"></a>
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-View-green?style=for-the-badge&logo=diagrams.net" alt="Architecture"></a>
  <a href="#installation"><img src="https://img.shields.io/badge/Setup-Local_Dev-orange?style=for-the-badge&logo=gear" alt="Setup"></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" alt="Socket.io" />
  <img src="https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white" alt="WebRTC" />
  <br/>
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white" alt="OpenAI" />
</p>

---

## Table of Contents
- [About the Project](#about-the-project)
- [The Problem & Solution](#the-problem--solution)
- [Core Features Deep Dive](#core-features-deep-dive)
- [System Architecture](#system-architecture)
- [Database Strategy](#database-strategy-dual-db)
- [Folder Structure](#folder-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Deployment Guidelines](#deployment-guidelines)

---

## About the Project

**DevSync AI** is a production-ready, ultra-modern collaborative coding environment designed to bridge the gap between individual practice and team-based software engineering. 

It combines the aesthetic and power of professional IDEs with real-time multiplayer collaboration, WebRTC-based video communication, and deeply integrated AI assistance. Whether facilitating pair programming, conducting technical interviews, or practicing algorithmic problems in a synchronized sandbox, DevSync AI provides a seamless, edge-to-edge premium experience.

---

## The Problem & Solution

| Traditional Limitations | DevSync AI Solution |
| :--- | :--- |
| **Scattered Tooling:** Teams rely on separate applications for video communication, algorithmic practice, and collaborative coding. | **Unified Hub:** Video calling, AI code execution, and LeetCode problem fetching are natively integrated into a single, cohesive IDE interface. |
| **Heavy Sandboxing:** Provisioning isolated Docker containers for secure code execution introduces significant latency and resource overhead. | **Virtual Execution Engine:** Employs a deterministic AI model (`temperature: 0.0`) to simulate terminal environments and standard input (`stdin`) instantly, bypassing containerization overhead. |
| **Volatile State:** Terminating a collaborative session often results in lost data if not manually saved. | **Intelligent Persistence:** In-memory socket state continuously tracks changes and automatically flushes the workspace data to PostgreSQL upon the final participant's disconnection. |

---

## Core Features Deep Dive

### Real-Time Collaborative Workspace
* **Multiplayer Editor:** Powered by Monaco Editor with sub-second Socket.io synchronization for real-time keystroke propagation.
* **Workspace Management:** Comprehensive file system capabilities enabling the creation, deletion, and navigation of multiple files.
* **Presence & Telemetry:** Integrated user presence tracking and real-time activity logging broadcasted across the workspace.

### AI-Powered Copilot & Execution
* **Context-Aware Chat:** AI Copilot retains conversation history and possesses continuous context of the active file's code.
* **Automated Code Audit:** Single-click comprehensive code reviews identifying security vulnerabilities, bugs, and optimization opportunities.
* **Virtual Execution Environment:** Simulates code execution dynamically, processing `stdin` for inputs and acting as a raw Linux terminal.

### Integrated WebRTC Video Calling
* **Peer-to-Peer Communication:** Low-latency video and audio transmission built directly into the IDE layout.
* **Screen Sharing Integration:** Seamlessly transition between camera feeds and high-resolution screen broadcasting.
* **Draggable & Resizable Interface:** The video communication panel supports full repositioning, multi-directional resizing, minimization, and fullscreen modes.
* **Robust Connectivity:** Leverages custom STUN and TURN server configurations to reliably traverse complex corporate firewalls and NATs.

### Coding Arena (LeetCode Integration)
* **Live Problem Synchronization:** Dynamically retrieves the top 100 problems directly from LeetCode via a secure backend GraphQL proxy.
* **Lazy-Loaded Optimization:** Fetches complex problem constraints and HTML formatting strictly on-demand to minimize initial load payloads.
* **Instant Sandbox Provisioning:** Instantiates a new collaborative workspace pre-populated with problem-specific boilerplate code via a single interaction.

### Enterprise-Grade Security & Authentication
* **2-Step Verification:** Registration mandates a 6-digit email OTP (facilitated by the Brevo HTTP API to circumvent restricted SMTP ports).
* **Role-Based Access Control (RBAC):** Enforces strict hierarchical permissions separating Workspace Owners and Collaborators.
* **Advanced Rate Limiting:** Implements global throttling, specific OTP request limits, and LeetCode API safeguards to mitigate abuse and DDOS vectors.
* **Stateless JWT Infrastructure:** Ensures secure, scalable authentication using JSON Web Tokens combined with robust frontend route guards.

---

## System Architecture

```mermaid
graph TD
    Client[React Frontend] <-->|REST API| Express[Express Backend]
    Client <-->|Socket.io| SocketServer[Real-Time Hub]
    Client <-->|WebRTC| Peers[Other Clients]
    
    Express <-->|Prisma ORM| Postgres[(PostgreSQL)]
    Express <-->|Mongoose| Mongo[(MongoDB)]
    
    Express -->|HTTP API| Brevo[Brevo Email API]
    Express -->|REST API| OpenAI[OpenAI Engine]
    Express -->|GraphQL Proxy| LeetCode[LeetCode API]
    
    SocketServer -->|In-Memory| ActiveState{Workspace State}
    ActiveState -.->|Auto-Save on Empty| Postgres
```

---

## Database Strategy (Dual DB)

To maximize performance and scalability, DevSync AI implements a dual-database architecture:

1. **PostgreSQL (via Prisma ORM):** 
   * **Purpose:** Highly relational, ACID-compliant data (Users, Projects, Workspace Memberships, Invitations).
   * **Advantage:** Ensures strict type-safety, prevents duplicate memberships via composite keys, and safely handles cascading deletions when a workspace is terminated.
2. **MongoDB (via Mongoose):** 
   * **Purpose:** High-throughput, unstructured or semi-structured data (Chat History, Activity Logs).
   * **Advantage:** Bypasses unnecessary relational joins, providing significantly faster write speeds for continuous, real-time workspace logging.

---

## Folder Structure

```text
DevSync-AI/
├── client/                     # React Frontend (Vite)
│   ├── src/
│   │   ├── components/         # Reusable UI components & WebRTC module
│   │   ├── pages/              # Main routes (Home, Workspace, Arena, Auth)
│   │   ├── redux/              # Global state management (Auth Slice)
│   │   ├── App.jsx             # React Router configuration
│   │   └── main.jsx            # Entry point
│   ├── index.html
│   └── tailwind.config.js
│
└── backend/                    # Node.js + Express Backend
    ├── lib/                    # Prisma Singleton connection
    ├── middleware/             # JWT Auth & RBAC Checkers
    ├── models/                 # MongoDB Mongoose schemas
    ├── prisma/                 # PostgreSQL schema & migrations
    ├── emailService.js         # Brevo API integration
    └── server.js               # Main HTTP/Socket/API engine
```

---

## Local Development Setup

### 1. Prerequisites
* Node.js (v18+)
* PostgreSQL instance
* MongoDB instance
* OpenAI API Key (or Azure GitHub Token)
* Brevo API Key (for email services)

### 2. Clone the Repository
```bash
git clone https://github.com/Anuj-pratap-singh-bhadauriya/DevSync-AI.git
cd DevSync-AI
```

### 3. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory (reference the [Environment Variables](#environment-variables) section below).

Initialize the database schema:
```bash
npx prisma generate
npx prisma db push
```

Start the backend server:
```bash
npm run dev
```

### 4. Frontend Setup
Open a new terminal window:
```bash
cd client
npm install
```

Create a `.env` file in the `client` directory:
```env
VITE_BACKEND_URL=http://localhost:5000
```

Start the Vite development server:
```bash
npm run dev
```

The application will be running at `http://localhost:5173`.

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5000` |
| `JWT_SECRET` | Secret key for signing JSON Web Tokens | `your_secure_random_string` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/devsync` |
| `GITHUB_TOKEN` | OpenAI/Azure API Key for Copilot & Execution | `ghp_xxxxxxxxxxxx` |
| `BREVO_API_KEY` | API Key for Brevo to send OTP emails | `xkeysib-xxxxxxxxxxxx` |
| `EMAIL_USER` | Verified sender email in Brevo | `hello@devsync.com` |
| `TURN_USERNAME` | Username for Metered TURN server (WebRTC) | `your_turn_user` |
| `TURN_CREDENTIAL` | Password for Metered TURN server (WebRTC) | `your_turn_pass` |

### Frontend (`client/.env`)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_BACKEND_URL` | URL of the running backend server | `http://localhost:5000` |

---

## Deployment Guidelines

### Frontend Deployment (Vercel)
1. Import the repository into Vercel.
2. Set the root directory to `client`.
3. Add the `VITE_BACKEND_URL` environment variable pointing to your deployed backend.
4. Note: The project includes a `vercel.json` file for proper React Router support.

### Backend Deployment (Render / Heroku)
1. Import the repository and set the root directory to `backend`.
2. Configure the build command: `npm install && npx prisma generate`
3. Configure the start command: `node server.js`
4. Ensure all environment variables (PostgreSQL, MongoDB, APIs) are injected.
5. The Brevo HTTP API is explicitly used over SMTP (Nodemailer) to prevent issues with Render's SMTP port restrictions.

---

<div align="center">
  <p>Engineered for high-performance collaborative software development.</p>
</div>
