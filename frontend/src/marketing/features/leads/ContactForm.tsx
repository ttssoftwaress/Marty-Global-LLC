import { useState, type FormEvent } from 'react';

import { ApiError } from '@/services/api';
import { useCreateLead } from './useLeads';

const EMPTY = { name: '', email: '', company: '', message: '' };

export function ContactForm() {
  const [values, setValues] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const createLead = useCreateLead();

  const fieldErrors =
    createLead.error instanceof ApiError ? createLead.error.fieldErrors : {};
  const formError =
    createLead.error instanceof ApiError && createLead.error.status !== 400
      ? createLead.error.message
      : null;

  function update(field: keyof typeof EMPTY, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(false);

    createLead.mutate(
      {
        name: values.name,
        email: values.email,
        company: values.company || undefined,
        message: values.message,
      },
      {
        onSuccess: () => {
          setValues(EMPTY);
          setSubmitted(true);
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field
        label="Name"
        value={values.name}
        onChange={(v) => update('name', v)}
        errors={fieldErrors.name}
      />
      <Field
        label="Email"
        type="email"
        value={values.email}
        onChange={(v) => update('email', v)}
        errors={fieldErrors.email}
      />
      <Field
        label="Company"
        hint="optional"
        value={values.company}
        onChange={(v) => update('company', v)}
        errors={fieldErrors.company}
      />
      <Field
        label="Message"
        multiline
        value={values.message}
        onChange={(v) => update('message', v)}
        errors={fieldErrors.message}
      />

      {formError && (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      )}

      {submitted && (
        <p role="status" className="text-sm text-green-700">
          Thanks — we received your enquiry and will be in touch.
        </p>
      )}

      <button
        type="submit"
        disabled={createLead.isPending}
        className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
      >
        {createLead.isPending ? 'Sending…' : 'Send enquiry'}
      </button>
    </form>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  errors?: string[];
  type?: string;
  hint?: string;
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChange,
  errors,
  type = 'text',
  hint,
  multiline,
}: FieldProps) {
  const id = label.toLowerCase();
  const invalid = Boolean(errors?.length);
  const className = `w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900/20 ${
    invalid ? 'border-red-500' : 'border-slate-300'
  }`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">({hint})</span>}
      </label>

      {multiline ? (
        <textarea
          id={id}
          rows={4}
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        />
      )}

      {errors?.map((error) => (
        <p key={error} role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ))}
    </div>
  );
}
