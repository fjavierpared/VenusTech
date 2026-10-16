import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/proyectos' }),
  schema: z.object({
    titulo: z.string(),
    cliente: z.string(),
    categoria: z.string(),
    resumen: z.string(),
    seoDescription: z.string(),
    reto: z.string(),
    solucion: z.string(),
    resultados: z.array(z.string()),
    metricas: z.array(z.object({ valor: z.string(), etiqueta: z.string() })).default([]),
    stack: z.array(z.string()),
    orden: z.number().default(99),
    destacado: z.boolean().default(false),
  }),
});

export const collections = { proyectos };
