# 🤖 WikiAI - My Personal Knowledge Base

Hey there! This is **WikiAI**, a project I built to have a private, smart wiki that actually knows my data. Instead of relying on a generic AI that might "hallucinate" or invent things, WikiAI uses my own documents (PDFs, notes, etc.) to provide accurate and grounded answers.

## 🛡️ Security Note: The missing `.env` file
For security reasons, you won't find the `.env.local` file in this repository. This file contains my private **Groq** and **Supabase** API keys. 

**If you want to run this project, you need to:**
1. Create a file named `.env.local` in the root folder.
2. Add your own credentials like this:
   ```text
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GROQ_API_KEY=your_groq_api_key
🧠 How it works (The Logic)
This app is based on the RAG (Retrieval-Augmented Generation) architecture. Here’s the "behind the scenes" of how the AI thinks:

Feeding the Brain (Ingestion): When I upload a PDF, the app doesn't just "read" it. It breaks the text into small chunks and transforms them into mathematical vectors (embeddings) using the all-MiniLM-L6-v2 model.

Memory (Vector Database): These vectors are stored in Supabase using the pgvector extension. Think of it as a spatial map of ideas.

The Search: When I ask a question, the app converts my question into a vector and looks for the "closest" (most similar) pieces of text in my database.

The Answer: It sends those specific pieces of text to Groq (Llama 3.3) as context. The AI then answers only based on that information. No imagination, just facts from my files.

🛠️ Tech Stack
Framework: Next.js 15 (App Router)

AI Model: Groq (Llama-3.3-70b-versatile) for ultra-fast inference.

Database: Supabase + pgvector for long-term "vector memory".

Embeddings: Xenova/Transformers (running locally on the server).

Styling: Tailwind CSS.

🚀 Getting Started
Clone the repo.

Run npm install to get all the dependencies.

Set up your .env.local file.

Run npm run dev to start the local server.

I'm really happy with how the RAG logic turned out, especially the custom system prompts that allow me to change the AI's tone and detail level!



















This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
