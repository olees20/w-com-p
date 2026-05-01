type CardProps = {
  title: string;
  value: string;
  description?: string;
};

export function Card({ title, value, description }: CardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
    </article>
  );
}
