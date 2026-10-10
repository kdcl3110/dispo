"use client";

// Fenêtre « Importer un fichier Excel » de la page Ressources (SPEC §8).
// On glisse-dépose le fichier, ou on le choisit sur l'ordinateur ; l'import
// part au clic sur « Importer », puis la fenêtre affiche le bilan.

import { Alert, Button, Modal, Upload, type UploadFile } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { importResourcesFile, type ImportResult } from "@/actions/import";
import { MAX_IMPORT_BYTES } from "@/lib/validation/resource";

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function ImportModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<UploadFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    if (!file?.originFileObj) return;
    const data = new FormData();
    data.set("file", file.originFileObj);
    startTransition(async () => {
      const response = await importResourcesFile(data);
      if (!response.ok) {
        setError(response.message);
        return;
      }
      setResult(response);
      router.refresh();
    });
  }

  // Après l'import : le bilan, et un seul bouton pour fermer.
  if (result) {
    return (
      <Modal open title="Import terminé" onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Fermer</Button>}>
        <div className="flex flex-col gap-4 pt-2">
          <dl className="flex flex-col border-t border-rule">
            {[
              ["Ressources créées", result.created],
              ["Déjà présentes", result.alreadyKnown],
              ["Lignes ignorées", result.ignored.length],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between border-b border-rule py-2.5">
                <dt className="text-graphite">{label}</dt>
                <dd className="text-base font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {result.ignored.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`${plural(result.ignored.length, "ligne n'a", "lignes n'ont")} pas été importée${result.ignored.length > 1 ? "s" : ""} :`}
              description={
                <ul className="mt-1 flex flex-col gap-1">
                  {result.ignored.map((row) => (
                    <li key={row.line}>
                      <strong className="font-semibold">Ligne {row.line} :</strong> {row.reason}
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      width={600}
      title="Importer des locaux et équipements"
      okText="Importer"
      cancelText="Annuler"
      okButtonProps={{ disabled: !file }}
      confirmLoading={pending}
      onOk={send}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-5 pt-2">
        <Upload.Dragger
          accept=".xls,.xlsx"
          maxCount={1}
          fileList={file ? [file] : []}
          // Rien ne part tant qu'on n'a pas cliqué sur « Importer ».
          beforeUpload={(chosen) => {
            setError(null);
            if (chosen.size > MAX_IMPORT_BYTES) {
              setError("Le fichier dépasse 1 Mo.");
              return Upload.LIST_IGNORE;
            }
            setFile({ uid: chosen.uid, name: chosen.name, size: chosen.size, status: "done", originFileObj: chosen });
            return false;
          }}
          onRemove={() => {
            setFile(null);
            setError(null);
          }}
        >
          <p className="text-base font-semibold text-ink">Glissez votre fichier Excel ici</p>
          <p className="mt-1 text-sm text-graphite">ou cliquez pour le choisir sur votre ordinateur (.xls ou .xlsx, 1 Mo au plus)</p>
        </Upload.Dragger>

        {error && <Alert type="error" showIcon title={error} />}

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">Format attendu</p>
          <p className="text-sm text-graphite">
            Première feuille, avec une ligne d&apos;en-tête contenant les colonnes <strong className="font-semibold text-ink">type</strong> et{" "}
            <strong className="font-semibold text-ink">name</strong>. La colonne type accepte local ou equipment.
          </p>
          <table className="w-full max-w-[360px] border-collapse font-mono text-[13px]">
            <thead>
              <tr className="bg-desk">
                <th className="border border-rule px-3 py-1.5 text-left font-medium">type</th>
                <th className="border border-rule px-3 py-1.5 text-left font-medium">name</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["local", "Salle B12"],
                ["local", "Auditoire 500"],
                ["equipment", "Projecteur 01"],
              ].map(([type, name]) => (
                <tr key={name}>
                  <td className="border border-rule px-3 py-1.5 text-graphite">{type}</td>
                  <td className="border border-rule px-3 py-1.5 font-sans">{name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-graphite">
            Vous pouvez relancer l&apos;import : une ressource déjà présente n&apos;est pas dupliquée. Les membres du personnel
            ne s&apos;importent pas, ils apparaissent à leur première connexion.
          </p>
        </div>
      </div>
    </Modal>
  );
}
