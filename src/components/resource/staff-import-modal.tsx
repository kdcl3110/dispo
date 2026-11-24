"use client";

// Fenêtre « Importer la liste du personnel » de la page Ressources. Seules
// les adresses de cette liste peuvent se connecter avec Google. L'import crée
// les comptes absents et rouvre l'accès de ceux qui l'avaient perdu ; il ne
// coupe l'accès de personne (cela se fait ligne par ligne dans le tableau).

import { Alert, Button, Modal, type UploadFile } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { importStaffFile, type StaffImportResult } from "@/actions/import";

import { FileDrop, Figures, IgnoredAlert } from "./import-modal";

export function StaffImportModal({ domains, onClose }: { domains: string[]; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<UploadFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<StaffImportResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();
  const domainList = domains.map((d) => `@${d}`).join(", ");

  function send() {
    if (!file?.originFileObj) return;
    const data = new FormData();
    data.set("file", file.originFileObj);
    startTransition(async () => {
      const response = await importStaffFile(data);
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response);
      router.refresh();
    });
  }

  if (result) {
    return (
      <Modal open title="Import terminé" onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Fermer</Button>}>
        <div className="flex flex-col gap-4 pt-2">
          <Figures
            items={[
              ["Comptes créés", result.created],
              ["Accès rouverts", result.reactivated.length],
              ["Déjà autorisés", result.alreadyKnown],
              ["Lignes ignorées", result.ignored.length],
            ]}
          />
          {result.reactivated.length > 0 && (
            <Alert
              type="info"
              showIcon
              title="Accès rouvert pour :"
              description={<p className="mt-1 break-words">{result.reactivated.join(", ")}</p>}
            />
          )}
          <IgnoredAlert ignored={result.ignored} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      width={640}
      title="Importer la liste du personnel"
      okText="Importer"
      cancelText="Annuler"
      okButtonProps={{ disabled: !file }}
      confirmLoading={pending}
      onOk={send}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-5 pt-2">
        <FileDrop
          accept=".xls,.xlsx,.csv"
          hint="ou cliquez pour le choisir sur votre ordinateur (.xls, .xlsx ou .csv, 1 Mo au plus)"
          file={file}
          onChange={setFile}
          onError={setError}
        />

        {error && <Alert type="error" showIcon title={error} />}

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">Format attendu</p>
          <p className="text-sm text-graphite">
            Première feuille, avec une ligne d&apos;en-tête contenant la colonne <strong className="font-semibold text-ink">email</strong>{" "}
            et, si vous le souhaitez, <strong className="font-semibold text-ink">name</strong>. Seules les adresses{" "}
            <strong className="font-semibold text-ink">{domainList || "(aucun domaine configuré)"}</strong> sont acceptées.
          </p>
          <table className="w-full border-collapse font-mono text-[13px]">
            <thead>
              <tr className="bg-desk">
                {["email", "name"].map((h) => (
                  <th key={h} className="border border-rule px-2.5 py-1.5 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ["claire.mertens@he2b.be", "Claire Mertens"],
                ["jean.dupont@he2b.be", ""],
              ].map(([email, name]) => (
                <tr key={email}>
                  <td className="border border-rule px-2.5 py-1.5">{email}</td>
                  <td className="border border-rule px-2.5 py-1.5 font-sans">{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-graphite">
            Vous pouvez relancer l&apos;import : une adresse déjà présente n&apos;est pas dupliquée, et celle dont l&apos;accès avait
            été coupé le retrouve. Les personnes absentes du fichier gardent leur accès : pour le couper, utilisez le bouton de leur
            ligne. À la première connexion, le nom du compte Google remplace celui du fichier.
          </p>
        </div>
      </div>
    </Modal>
  );
}
