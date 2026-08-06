import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Command,
  Filter,
  Layers3,
  Menu,
  MoreHorizontal,
  PanelRight,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Avatar,
  AvatarFallback,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  Button,
  Card,
  Container,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  GlassPanel,
  Grid,
  IconButton,
  LoadingState,
  NavigationItem,
  Pagination,
  PaginationButton,
  PaginationStatus,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Progress,
  SearchField,
  Separator,
  SkipLink,
  Spinner,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  VisuallyHidden,
} from './components/ui';

const navItems = ['Overview', 'Primitives', 'Surfaces', 'Data'];
const tableRows = [
  { name: 'Navigation shell', status: 'Ready', detail: 'Keyboard-safe' },
  { name: 'Overlay suite', status: 'Ready', detail: 'Focus-managed' },
  { name: 'Data shell', status: 'Ready', detail: 'Responsive' },
];

export function App() {
  return (
    <TooltipProvider>
      <ToastProvider swipeDirection="right">
        <SkipLink>Skip to shared component showcase</SkipLink>
        <main id="main-content" className="min-h-screen overflow-x-hidden py-8 text-slate-50">
          <Container>
            <Stack className="gap-8">
              <motion.section
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="grid gap-6 xl:grid-cols-[18rem_1fr]"
              >
                <GlassPanel className="h-fit p-4">
                  <div className="flex items-center gap-3 px-2 py-3">
                    <Avatar>
                      <AvatarFallback>CA</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-white">Clinora AI</p>
                      <p className="text-xs text-slate-400">Shared UI system</p>
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <nav aria-label="Showcase sections" className="grid gap-2">
                    {navItems.map((item, index) => (
                      <NavigationItem key={item} href="#main-content" active={index === 0}>
                        <Layers3 aria-hidden="true" size={18} />
                        {item}
                      </NavigationItem>
                    ))}
                  </nav>
                </GlassPanel>

                <GlassPanel className="relative overflow-hidden p-8">
                  <div className="absolute right-8 top-8 hidden text-cyan-200/30 md:block">
                    <Sparkles aria-hidden="true" size={80} />
                  </div>
                  <Stack className="relative gap-6">
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>Design system</BreadcrumbItem>
                        <BreadcrumbItem aria-hidden="true">/</BreadcrumbItem>
                        <BreadcrumbItem>
                          <span className="text-slate-200">Phase 2B</span>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                    <div className="grid gap-4">
                      <Badge variant="info" className="w-fit">
                        Phase 2B shared components
                      </Badge>
                      <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                        Navigation, overlays, data shells, and interaction primitives.
                      </h1>
                      <p className="max-w-3xl text-base leading-7 text-slate-300">
                        This showcase proves reusable interface building blocks without implementing protected routes,
                        clinical records, business APIs, or role-specific application behavior.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button>
                            <Command aria-hidden="true" size={18} />
                            Explore primitives
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Generic controls only; Phase 3 workflows are not included.</TooltipContent>
                      </Tooltip>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary">Open dialog</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogTitle>Reusable confirmation surface</DialogTitle>
                          <DialogDescription>
                            Dialogs are focus-managed shells for future workflows. This preview does not perform any
                            application action.
                          </DialogDescription>
                          <div className="flex justify-end gap-3">
                            <DialogClose asChild>
                              <Button variant="secondary">Close</Button>
                            </DialogClose>
                          </div>
                        </DialogContent>
                      </Dialog>

                      <Drawer>
                        <DrawerTrigger asChild>
                          <Button variant="secondary">
                            <PanelRight aria-hidden="true" size={18} />
                            Drawer
                          </Button>
                        </DrawerTrigger>
                        <DrawerContent>
                          <DrawerTitle>Responsive side panel</DrawerTitle>
                          <DrawerDescription>
                            Drawers provide mobile-safe secondary surfaces for later navigation and filters.
                          </DrawerDescription>
                          <Separator />
                          <DrawerClose asChild>
                            <Button variant="secondary">Close drawer</Button>
                          </DrawerClose>
                        </DrawerContent>
                      </Drawer>
                    </div>
                  </Stack>
                </GlassPanel>
              </motion.section>

              <Grid>
                <GlassPanel className="xl:col-span-4">
                  <Stack>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">Interactions</h2>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton aria-label="Open interaction menu" variant="ghost">
                            <MoreHorizontal aria-hidden="true" size={20} />
                          </IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem>Preview item</DropdownMenuItem>
                          <DropdownMenuItem>Keyboard item</DropdownMenuItem>
                          <DropdownMenuItem disabled>Disabled item</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Tabs defaultValue="one">
                      <TabsList aria-label="Interaction examples">
                        <TabsTrigger value="one">Tabs</TabsTrigger>
                        <TabsTrigger value="two">Search</TabsTrigger>
                      </TabsList>
                      <TabsContent value="one">
                        <Alert>Tabs provide accessible panel switching for future workspaces.</Alert>
                      </TabsContent>
                      <TabsContent value="two">
                        <SearchField aria-label="Search components" placeholder="Search shared components" />
                      </TabsContent>
                    </Tabs>
                    <Accordion type="single" collapsible>
                      <AccordionItem value="details">
                        <AccordionTrigger>Why these components are generic</AccordionTrigger>
                        <AccordionContent>
                          They carry layout, focus, keyboard, and visual behavior only. Data, permissions, and business
                          workflows are intentionally deferred.
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </Stack>
                </GlassPanel>

                <GlassPanel className="xl:col-span-4">
                  <Stack>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-xl font-semibold">Overlay controls</h2>
                      <Popover>
                        <PopoverTrigger asChild>
                          <IconButton aria-label="Open filter preview" variant="ghost">
                            <Filter aria-hidden="true" size={20} />
                          </IconButton>
                        </PopoverTrigger>
                        <PopoverContent>
                          <Stack>
                            <p className="font-semibold">Generic filter shell</p>
                            <p className="text-sm leading-6 text-slate-300">
                              Future filters can reuse this surface after domain APIs are authorized.
                            </p>
                            <PopoverClose asChild>
                              <Button variant="secondary" size="sm">
                                Close
                              </Button>
                            </PopoverClose>
                          </Stack>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Card>
                      <div className="flex items-center gap-3">
                        <Bell aria-hidden="true" className="text-cyan-300" />
                        <div>
                          <p className="font-semibold">Toast shell</p>
                          <p className="text-sm text-slate-400">Accessible transient feedback, not notifications.</p>
                        </div>
                      </div>
                    </Card>
                    <Toast defaultOpen>
                      <ToastTitle>Local preview message</ToastTitle>
                      <ToastDescription>This toast is a UI primitive only.</ToastDescription>
                      <ToastClose>Dismiss</ToastClose>
                    </Toast>
                    <ToastViewport />
                  </Stack>
                </GlassPanel>

                <GlassPanel className="xl:col-span-4">
                  <Stack>
                    <h2 className="text-xl font-semibold">Responsive states</h2>
                    <LoadingState className="flex items-center gap-3">
                      <Spinner />
                      <span>Stable loading layout</span>
                    </LoadingState>
                    <Progress value={72} aria-label="Shared component completion" />
                    <EmptyState>
                      <p className="font-semibold text-white">Empty shell</p>
                      <p className="mt-2 text-sm text-slate-400">No domain data is rendered in Phase 2B.</p>
                    </EmptyState>
                    <ErrorState>Recoverable error shell with explicit text.</ErrorState>
                  </Stack>
                </GlassPanel>
              </Grid>

              <GlassPanel>
                <Stack className="gap-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                      <h2 className="text-xl font-semibold">Data-display shell</h2>
                      <p className="mt-2 text-sm text-slate-400">
                        Semantic table and pagination structure without live records or API calls.
                      </p>
                    </div>
                    <SearchField
                      aria-label="Search table preview"
                      className="md:max-w-xs"
                      placeholder="Filter preview"
                    />
                  </div>
                  <TableShell>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Primitive</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Accessibility note</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableRows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell>
                              <Badge variant="success">{row.status}</Badge>
                            </TableCell>
                            <TableCell>{row.detail}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableShell>
                  <Pagination>
                    <PaginationButton aria-label="Previous page">
                      <ChevronLeft aria-hidden="true" size={16} />
                    </PaginationButton>
                    <PaginationStatus>Page 1 of 1</PaginationStatus>
                    <PaginationButton aria-label="Next page">
                      <ChevronRight aria-hidden="true" size={16} />
                    </PaginationButton>
                  </Pagination>
                </Stack>
              </GlassPanel>

              <VisuallyHidden>
                Phase 2B does not include authentication, dashboards, or clinical workflows.
              </VisuallyHidden>
              <div className="fixed bottom-4 left-4 md:hidden">
                <IconButton aria-label="Open mobile preview menu" variant="secondary">
                  <Menu aria-hidden="true" size={20} />
                </IconButton>
              </div>
            </Stack>
          </Container>
        </main>
      </ToastProvider>
    </TooltipProvider>
  );
}
