"use client";

// Fenêtre « Importer des locaux et équipements » de la page Ressources (SPEC §8).
// On glisse-dépose le fichier, ou on le choisit sur l'ordinateur ; l'import
// part au clic sur « Importer », puis la fenêtre affiche le bilan.
// FileDrop, Figures et IgnoredAlert servent aussi à l'import du personnel.

import { Alert, Button, Modal, Upload, type UploadFile } from "antd";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { importResourcesFile, type ImportResult } from "@/actions/import";
import type { IgnoredRow } from "@/lib/import";
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
          <Figures
            items={[
              ["Ressources créées", result.created],
              ["Locaux mis à jour", result.updated],
              ["Déjà présentes, inchangées", result.alreadyKnown],
              ["Lignes ignorées", result.ignored.length],
            ]}
          />
          {(result.createdRoomTypes.length > 0 || result.createdFeatures.length > 0) && (
            <Alert
              type="info"
              showIcon
              title="Ajoutés aux listes"
              description={
                <ul className="mt-1 flex flex-col gap-1">
                  {result.createdRoomTypes.length > 0 && (
                    <li>
                      <strong className="font-semibold">Types de local :</strong> {result.createdRoomTypes.join(", ")}
                    </li>
                  )}
                  {result.createdFeatures.length > 0 && (
                    <li>
                      <strong className="font-semibold">Caractéristiques :</strong> {result.createdFeatures.join(", ")}
                    </li>
                  )}
                </ul>
              }
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
      width={720}
      title="Importer des locaux et équipements"
      okText="Importer"
      cancelText="Annuler"
      okButtonProps={{ disabled: !file }}
      confirmLoading={pending}
      onOk={send}
      onCancel={onClose}
    >
      <div className="flex flex-col gap-5 pt-2">
        <FileDrop
          accept=".xls,.xlsx"
          hint="ou cliquez pour le choisir sur votre ordinateur (.xls ou .xlsx, 1 Mo au plus)"
          file={file}
          onChange={setFile}
          onError={setError}
        />

        {error && <Alert type="error" showIcon title={error} />}

        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold">Format attendu</p>
          <p className="text-sm text-graphite">
            Première feuille, avec une ligne d&apos;en-tête contenant les colonnes <strong className="font-semibold text-ink">type</strong> et{" "}
            <strong className="font-semibold text-ink">name</strong>. La colonne type accepte local ou equipment. Pour décrire les locaux,
            ajoutez si vous le souhaitez <strong className="font-semibold text-ink">room_type</strong>,{" "}
            <strong className="font-semibold text-ink">capacity</strong>, <strong className="font-semibold text-ink">building</strong> et{" "}
            <strong className="font-semibold text-ink">features</strong> (séparées par des virgules, quantité entre parenthèses).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-mono text-[13px]">
              <thead>
                <tr className="bg-desk">
                  {["type", "name", "room_type", "capacity", "building", "features"].map((h) => (
                    <th key={h} className="border border-rule px-2.5 py-1.5 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["local", "Salle B12", "Salle de cours", "40", "Bâtiment B", "Projecteur, Tableau blanc"],
                  ["local", "Labo 2.04", "Labo informatique", "30", "Bâtiment A", "PC (30), Projecteur"],
                  ["equipment", "Projecteur 01", "", "", "", ""],
                ].map(([type, ...cells]) => (
                  <tr key={cells[0]}>
                    <td className="border border-rule px-2.5 py-1.5 text-graphite">{type}</td>
                    {cells.map((cell, i) => (
                      <td key={i} className="border border-rule px-2.5 py-1.5 font-sans whitespace-nowrap">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-graphite">
            Vous pouvez relancer l&apos;import : une ressource déjà présente n&apos;est pas dupliquée, et la description d&apos;un local
            déjà connu est mise à jour pour les colonnes présentes dans le fichier. Un type de local ou une caractéristique
            inconnus sont ajoutés aux listes. Les membres du personnel ont leur propre import : « Liste du personnel ».
          </p>
        </div>
      </div>
    </Modal>
  );
}

// Zone de dépôt d'un seul fichier. Rien ne part tant qu'on n'a pas cliqué sur
// « Importer » : le fichier est seulement gardé en mémoire.
export function FileDrop({
  accept,
  hint,
  file,
  onChange,
  onError,
}: {
  accept: string;
  hint: string;
  file: UploadFile | null;
  onChange: (file: UploadFile | null) => void;
  onError: (message: string | null) => void;
}) {
  return (
    <Upload.Dragger
      accept={accept}
      maxCount={1}
      fileList={file ? [file] : []}
      beforeUpload={(chosen) => {
        onError(null);
        if (chosen.size > MAX_IMPORT_BYTES) {
          onError("Le fichier dépasse 1 Mo.");
          return Upload.LIST_IGNORE;
        }
        onChange({ uid: chosen.uid, name: chosen.name, size: chosen.size, status: "done", originFileObj: chosen });
        return false;
      }}
      onRemove={() => {
        onChange(null);
        onError(null);
      }}
    >
      <p className="text-base font-semibold text-ink">Glissez votre fichier ici</p>
      <p className="mt-1 text-sm text-graphite">{hint}</p>
    </Upload.Dragger>
  );
}

// Chiffres du bilan d'un import.
export function Figures({ items }: { items: [string, number][] }) {
  return (
    <dl className="flex flex-col border-t border-rule">
      {items.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between border-b border-rule py-2.5">
          <dt className="text-graphite">{label}</dt>
          <dd className="text-base font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Lignes refusées, avec leur raison.
export function IgnoredAlert({ ignored }: { ignored: IgnoredRow[] }) {
  if (ignored.length === 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      title={`${plural(ignored.length, "ligne n'a", "lignes n'ont")} pas été importée${ignored.length > 1 ? "s" : ""} :`}
      description={
        <ul className="mt-1 flex flex-col gap-1">
          {ignored.map((row) => (
            <li key={row.line}>
              <strong className="font-semibold">Ligne {row.line} :</strong> {row.reason}
            </li>
          ))}
        </ul>
      }
    />
  );
}
