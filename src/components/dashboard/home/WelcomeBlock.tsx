import { t as __tr } from "../../../lib/i18n";
import { Button } from "../../ui";

/** Shown instead of Home while the vault has no entries and no folders. */
export default function WelcomeBlock() {
  return (
    <div className="flex-1 flex items-center justify-center bg-editor h-full">
      <div className="text-center max-w-md">
        <h2 className="text-title text-ink mb-2">{__tr("Welcome to Conduit")}</h2>
        <p className="text-body text-ink-muted mb-6">
          {__tr("Get started by creating your first entry or connecting to a remote host.")}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="primary" onClick={() => document.dispatchEvent(new CustomEvent("conduit:new-entry"))}>
            {__tr("New Entry")}</Button>
          <Button variant="secondary" onClick={() => document.dispatchEvent(new CustomEvent("conduit:quick-connect"))}>
            {__tr("Quick Connect")}</Button>
        </div>
      </div>
    </div>
  );
}
