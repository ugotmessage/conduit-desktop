import { t as __tr } from "../../lib/i18n";
import { useState } from "react";
import { IconButton } from "./IconButton";
import { TextInput, type TextInputProps } from "./TextInput";

export type PasswordInputProps = Omit<TextInputProps, "type" | "trailing">;

export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <TextInput
      {...props}
      type={show ? "text" : "password"}
      trailing={
        <IconButton size="sm" icon={show ? "eyeOff" : "eye"} label={show ? __tr("Hide password") : __tr("Show password")} onClick={() => setShow((s) => !s)} />
      }
    />
  );
}
