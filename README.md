# LED ERP & Storefront

## Tech Stack
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS + Shadcn/UI
- PostgreSQL + Prisma
- Zustand + Nuqs
- React Hook Form + Zod

## Getting Started

1. **Install dependencies:**
   Since this environment might be restricted, please run this in your local terminal:
   ```bash
   npm install
   ```

2. **Initialize Shadcn UI:**
   ```bash
   npx shadcn-ui@latest init
   ```
   (Accept defaults, ensure you select `src` directory)

3. **Set up Database:**
   - Create a `.env` file with `DATABASE_URL`.
   - Run migrations:
     ```bash
     npx prisma generate
     npx prisma db push
     ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## Folder Structure
- `src/app/(storefront)`: Public facing e-commerce site.
- `src/app/(admin)`: Admin ERP interface (protected).
- `src/components/ui`: Reusable UI components (Shadcn).
- `src/components/features`: Business logic components.
