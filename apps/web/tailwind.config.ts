import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

const colors = [
  'slate','gray','zinc','neutral','stone',
  'red','orange','amber','yellow','lime','green','emerald',
  'teal','cyan','sky','blue','indigo','violet','purple','fuchsia','pink','rose',
]
const shades = [50,100,200,300,400,500,600,700,800,900,950]
const prefixes = ['bg','text','border','ring','stroke','fill']

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: prefixes.flatMap(p =>
    colors.flatMap(c =>
      shades.map(s => `${p}-${c}-${s}`)
    )
  ),
  theme: {
    extend: {},
  },
  plugins: [typography],
}

export default config
