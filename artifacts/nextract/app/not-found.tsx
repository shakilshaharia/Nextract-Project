import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/layout/PageHero";
import { ReportNotFound } from "@/components/layout/ReportNotFound";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { notFound as notFoundCopy } from "@/lib/pages";
import styles from "./not-found.module.css";

// Next adds <meta name="robots" content="noindex"> to not-found responses itself.
export const metadata: Metadata = { title: "Page not found | Nextract" };

export default function NotFound() {
  return (
    <>
      <main>
        <PageHero>
          <div className={styles.wrap}>
            <Image
              className={styles.art}
              src="/images/404/not-found.png"
              alt=""
              width={1080}
              height={660}
              priority
            />
            <h1 className={`display ${styles.title}`}>{notFoundCopy.title}</h1>
            <p className={styles.description}>{notFoundCopy.description}</p>
          </div>
        </PageHero>
      </main>
      <ReportNotFound />
      <SiteFooter />
    </>
  );
}
