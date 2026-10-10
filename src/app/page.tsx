import { APP_NAME, APP_NAME_HI, APP_TAGLINE_EN, APP_TAGLINE_HI } from "@/core/appInfo";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        {APP_NAME}: <span lang="hi">{APP_NAME_HI}</span>
      </h1>
      <p lang="hi" className="text-xl leading-8">
        {APP_TAGLINE_HI}
      </p>
      <p lang="en" className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
        {APP_TAGLINE_EN}
      </p>
      <p className="text-sm text-zinc-500">
        PM-KISAN · Orunodoi 3.0 (Assam) · Widow Pension (NSAP). Coming soon.
      </p>
    </main>
  );
}
