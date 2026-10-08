"use client";

import { CORE_CODE } from "./example";
import { usePollar } from "@pollar/react";
import { SdkModalTab } from "@/app/_components/SdkDocs";
import { useI18n } from "@/app/_i18n/LanguageProvider";

// ─── code previews ────────────────────────────────────────────────────────────

const REACT_CODE = `import { usePollar } from '@pollar/react';

export function BuyCryptoButton() {
  const { openRampModal, isAuthenticated } = usePollar();

  // The SDK renders enabled routes, exact totals and saved actions.
  // Continue and signing require an explicit click; polling only reads.
  return (
    <button
      onClick={openRampModal}
      disabled={!isAuthenticated}
    >
      Buy / sell crypto
    </button>
  );
}`;

// ─── page ─────────────────────────────────────────────────────────────────────

export default function RampPage() {
  const { t } = useI18n();
  const { openRampModal, isAuthenticated } = usePollar();

  return (
    <div className="w-full max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {t.ramp.title}
        </h1>
        <p className="text-sm text-muted mt-1.5">{t.ramp.desc}</p>
      </div>

      <a className="inline-block border rounded p-2" href="/pollar/ramp/stereum-fixture">Test Stereum with local fixtures</a>
      <SdkModalTab
        isAuthenticated={isAuthenticated}
        onOpen={openRampModal}
        openLabel={t.ramp.open}
        connectLabel={t.common.connectWalletFirst}
        modalCall="openRampModal()"
        modalNote={t.ramp.note}
        reactDesc={t.ramp.reactDesc}
        coreDesc={t.ramp.coreDesc}
        coreCode={CORE_CODE}
        reactCode={REACT_CODE}
        core={{
          title: t.ramp.coreFnsTitle,
          intro: t.ramp.coreFnsIntro,
          fns: t.ramp.coreFns,
        }}
        react={{
          title: t.ramp.reactFnsTitle,
          intro: t.ramp.reactFnsIntro,
          fns: t.ramp.reactFns,
        }}
      />
    </div>
  );
}
