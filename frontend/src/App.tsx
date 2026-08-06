import { Activity, AlertCircle, ArrowRight, CheckCircle2, Search, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Container,
  EmptyState,
  ErrorState,
  FormField,
  FormMessage,
  GlassPanel,
  Grid,
  IconButton,
  Input,
  Label,
  Link,
  LoadingState,
  Progress,
  Radio,
  Select,
  Skeleton,
  SkipLink,
  Spinner,
  Stack,
  Switch,
  Textarea,
  VisuallyHidden,
} from './components/ui';
import { designTokens } from './styles/tokens';

export function App() {
  return (
    <>
      <SkipLink>Skip to design-system preview</SkipLink>
      <main id="main-content" className="min-h-screen overflow-x-hidden py-10 text-slate-50">
        <Container>
          <Stack className="gap-8">
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]"
            >
              <GlassPanel className="flex min-h-80 flex-col justify-between gap-8 p-8">
                <Stack className="gap-5">
                  <Badge variant="info" className="w-fit">
                    Phase 2A foundation
                  </Badge>
                  <div className="grid gap-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-200">Clinora AI</p>
                    <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                      Core design-system primitives are ready for review.
                    </h1>
                    <p className="max-w-2xl text-base leading-7 text-slate-300">
                      This non-production showcase verifies tokens, layout, accessibility utilities, controls, surfaces,
                      and feedback states without implementing clinical workflows or backend integration.
                    </p>
                  </div>
                </Stack>
                <div className="flex flex-wrap gap-3">
                  <Button>
                    Primary action <ArrowRight aria-hidden="true" size={18} />
                  </Button>
                  <Button variant="secondary">Secondary action</Button>
                  <IconButton aria-label="Open design settings" variant="ghost">
                    <Settings aria-hidden="true" size={20} />
                  </IconButton>
                </div>
              </GlassPanel>

              <Card className="flex flex-col justify-between gap-6 rounded-[var(--radius-card-large)]">
                <Stack>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">Token sample</h2>
                    <Activity aria-hidden="true" className="text-cyan-300" />
                  </div>
                  <p className="text-sm leading-6 text-slate-300">
                    Source values are exposed as CSS variables and mirrored in TypeScript for predictable reuse.
                  </p>
                </Stack>
                <div className="grid grid-cols-3 gap-3" aria-label="Core color tokens">
                  {Object.entries(designTokens.color)
                    .slice(0, 6)
                    .map(([name, value]) => (
                      <div key={name} className="grid gap-2">
                        <span className="h-12 rounded-2xl border border-white/10" style={{ background: value }} />
                        <span className="truncate text-xs text-slate-400">{name}</span>
                      </div>
                    ))}
                </div>
              </Card>
            </motion.section>

            <Grid>
              <GlassPanel className="xl:col-span-5">
                <Stack>
                  <h2 className="text-xl font-semibold">Form primitives</h2>
                  <FormField>
                    <Label htmlFor="preview-search">Search label</Label>
                    <div className="relative">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                        size={18}
                      />
                      <Input id="preview-search" className="pl-11" placeholder="Accessible input" />
                    </div>
                    <FormMessage>Helper and error text share one predictable message pattern.</FormMessage>
                  </FormField>
                  <FormField>
                    <Label htmlFor="preview-select">Select label</Label>
                    <Select id="preview-select" defaultValue="default">
                      <option value="default">Default option</option>
                      <option value="alternate">Alternate option</option>
                    </Select>
                  </FormField>
                  <FormField>
                    <Label htmlFor="preview-notes">Textarea label</Label>
                    <Textarea id="preview-notes" placeholder="Multiline field" />
                  </FormField>
                  <div className="flex flex-wrap items-center gap-5 text-sm text-slate-300">
                    <Label className="flex items-center gap-2">
                      <Checkbox aria-label="Preview checkbox" /> Checkbox
                    </Label>
                    <Label className="flex items-center gap-2">
                      <Radio name="preview-radio" aria-label="Preview radio" /> Radio
                    </Label>
                    <Label className="flex items-center gap-2">
                      <Switch aria-label="Preview switch" checked /> Switch
                    </Label>
                  </div>
                </Stack>
              </GlassPanel>

              <GlassPanel className="xl:col-span-4">
                <Stack>
                  <h2 className="text-xl font-semibold">Feedback states</h2>
                  <Alert>
                    <CheckCircle2 aria-hidden="true" className="mr-2 inline text-green-200" size={18} />
                    Status messages avoid color-only meaning.
                  </Alert>
                  <ErrorState>
                    <AlertCircle aria-hidden="true" className="mr-2 inline" size={18} />
                    Error states reserve space for clear recovery copy.
                  </ErrorState>
                  <LoadingState className="flex items-center gap-3">
                    <Spinner />
                    <span>Loading state with stable layout</span>
                  </LoadingState>
                  <Progress value={64} aria-label="Preview progress" />
                </Stack>
              </GlassPanel>

              <GlassPanel className="xl:col-span-3">
                <Stack>
                  <h2 className="text-xl font-semibold">Empty and skeleton</h2>
                  <EmptyState>
                    <p className="font-medium text-white">No preview data</p>
                    <p className="mt-2 text-sm text-slate-400">Domain content is intentionally deferred.</p>
                  </EmptyState>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Link href="#main-content">Accessible link</Link>
                  <VisuallyHidden>Screen-reader utility is available.</VisuallyHidden>
                </Stack>
              </GlassPanel>
            </Grid>
          </Stack>
        </Container>
      </main>
    </>
  );
}
