import { zodResolver } from '@hookform/resolvers/zod';
import type { FieldValues, Resolver } from 'react-hook-form';

/**
 * zod v4's stricter input/output typing makes z.coerce fields (string input -> number output)
 * incompatible with react-hook-form's single-generic useForm<FormValues>() signature.
 * This cast is safe: the resolver only ever hands onSubmit the parsed (output) shape.
 * `T` is inferred from the surrounding useForm<FormValues>({ resolver: formResolver(schema) }) call.
 */
export function formResolver<T extends FieldValues>(schema: unknown): Resolver<T> {
  return zodResolver(schema as never) as unknown as Resolver<T>;
}
