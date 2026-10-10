"use client";

// Formulaire admin (identifiant + mot de passe), en composants Ant Design.
//
// Le <form> reste natif et branché sur la Server Action : la connexion marche
// même avant le chargement du JavaScript. Ant ne fournit ici que la mise en
// forme (Form en mode « component={false} » : pas de second <form>, pas de
// gestion d'état côté Ant).

import { Alert, Button, Form, Input } from "antd";
import { useActionState } from "react";

import { loginWithCredentials } from "@/actions/auth";

export function CredentialsForm() {
  const [error, formAction, pending] = useActionState(loginWithCredentials, undefined);
  const status = error ? "error" : undefined;

  return (
    <form action={formAction}>
      <Form layout="vertical" component={false} requiredMark={false}>
        <Form.Item label="Identifiant" htmlFor="username" validateStatus={status}>
          <Input id="username" name="username" required autoComplete="username" size="large" />
        </Form.Item>

        <Form.Item label="Mot de passe" htmlFor="password" validateStatus={status}>
          <Input.Password id="password" name="password" required autoComplete="current-password" size="large" />
        </Form.Item>

        {error && <Alert type="error" showIcon title={error} className="mb-6" />}

        <Button type="primary" htmlType="submit" size="large" block loading={pending}>
          Se connecter
        </Button>
      </Form>
    </form>
  );
}
