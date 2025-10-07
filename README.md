# 🧾 Project Handover Document

Welcome! This document will guide you through setting up and running the **Kamdhenuseva backend** project on your local system.

---

## 📁 Project Overview

This is a **Node.js** backend application using **TypeScript** and **Express**. The project uses Razorpay for donation processing.

---

## ⚙️ Prerequisites

Ensure the following tools are installed on your system:

- **Node.js** (v18 or higher recommended)
- **PNPM** (v8 or higher)
- **Git** (optional, for version control)

---

## 🚀 Project Setup Instructions

Assuming the project folder is already on your system, follow these steps:

### 1. Open a Terminal and Navigate to the Project Directory

```bash
cd kamdhenuseva-backend
```

---

### 2. Install Dependencies with PNPM

```bash
pnpm install
```

This will install all required packages listed in `package.json`.

---

### 3. Create a Local `.env` File

Duplicate the provided `.env.example` file and rename it to `.env.local`:

```bash
cp .env.example .env.local
```

Update the following values in `.env.local` with your actual credentials:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_public_key
```

---

### 4. Run the Development Server

```bash
pnpm dev
```

This will start the development server on [http://localhost:3000](http://localhost:3000).

---

### 5. Build & Run for Production (Optional)

To build the production version:

```bash
pnpm build
```

To start the production server after building:

```bash
pnpm start
```

---

## 🧼 Code Quality

This project uses **Prettier** and **ESLint** for code formatting and linting.

- Format code:

  ```bash
  pnpm predev
  ```

- Lint code:

  ```bash
  pnpm lint
  ```

---

## 🧩 Useful Scripts

| Command       | Description                     |
| ------------- | ------------------------------- |
| `pnpm dev`    | Starts the development server   |
| `pnpm build`  | Builds the app for production   |
| `pnpm start`  | Runs the app in production mode |
| `pnpm lint:fix`   | Lints the codebase              |
| `pnpm predev` | Formats the code using Prettier |

---

## 📬 Need Help?

If you run into any issues or have questions, feel free to reach out to the original development team for assistance.

---
