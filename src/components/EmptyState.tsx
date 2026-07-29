interface Props {
  title: string;
  message: string;
}

export default function EmptyState({ title, message }: Props) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-900 px-6 py-16 text-center">
      <p className="text-lg font-semibold text-ink-100">{title}</p>
      <p className="mt-2 text-sm text-ink-400">{message}</p>
    </div>
  );
}
