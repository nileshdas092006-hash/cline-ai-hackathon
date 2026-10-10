import { APP_DESCRIPTION_EN, APP_NAME, APP_NAME_AS, APP_TAGLINE_AS, APP_TAGLINE_EN } from "@/core/appInfo";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">
        <span lang="en">{APP_NAME}</span>: {APP_NAME_AS}
      </h1>
      <p className="text-2xl leading-9">{APP_TAGLINE_AS}</p>
      <p lang="en" className="text-xl leading-8 text-zinc-700 dark:text-zinc-300">
        {APP_TAGLINE_EN}
      </p>
      <p lang="en" className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
        {APP_DESCRIPTION_EN}
      </p>
      <p lang="en" className="text-sm text-zinc-500">
        PM-KISAN · Orunodoi 3.0 (Assam) · Widow Pension (NSAP). Coming soon.
      </p>
    </main>
  );
}
