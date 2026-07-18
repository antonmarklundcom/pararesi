import { Button } from "@/components/ui/Button";
import { MarkdownTextarea } from "./MarkdownTextarea";

export type FieldConfig =
  | { type: "text"; name: string; label: string; required?: boolean }
  | { type: "textarea"; name: string; label: string }
  | { type: "markdown"; name: string; label: string }
  | { type: "number"; name: string; label: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "datetime"; name: string; label: string };

export type EntityFormValues = Record<string, string | number | Date | null | undefined>;

function toDatetimeLocalValue(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function EntityForm({
  fields,
  initialValues = {},
  action,
  submitLabel = "Save",
}: {
  fields: FieldConfig[];
  initialValues?: EntityFormValues;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="max-w-2xl space-y-5">
      {fields.map((field) => {
        const value = initialValues[field.name];

        if (field.type === "markdown") {
          return (
            <MarkdownTextarea
              key={field.name}
              name={field.name}
              label={field.label}
              defaultValue={value != null ? String(value) : ""}
            />
          );
        }

        if (field.type === "textarea") {
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-sm font-medium text-brand-navy-900">
                {field.label}
              </label>
              <textarea
                id={field.name}
                name={field.name}
                rows={3}
                defaultValue={value != null ? String(value) : ""}
                className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
              />
            </div>
          );
        }

        if (field.type === "select") {
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-sm font-medium text-brand-navy-900">
                {field.label}
              </label>
              <select
                id={field.name}
                name={field.name}
                defaultValue={value != null ? String(value) : field.options[0]?.value}
                className="mt-1 w-full rounded-lg border border-brand-navy-900/20 bg-white px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
              >
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }

        if (field.type === "datetime") {
          return (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-sm font-medium text-brand-navy-900">
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(value)}
                className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
              />
            </div>
          );
        }

        return (
          <div key={field.name}>
            <label htmlFor={field.name} className="block text-sm font-medium text-brand-navy-900">
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type === "number" ? "number" : "text"}
              required={field.type === "text" ? field.required : false}
              defaultValue={value != null ? String(value) : ""}
              className="mt-1 w-full rounded-lg border border-brand-navy-900/20 px-3 py-2 text-sm focus:border-brand-green-600 focus:outline-none"
            />
          </div>
        );
      })}

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
