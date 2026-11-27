import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { Redirect, Route, Router, Switch, useLocation } from 'wouter';
import { ConfirmProvider } from '@/components/dialog';
import { Shell } from '@/components/shell';
import { ButtonLink, EmptyState, PageLoader } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ActivityPage } from '@/pages/activity';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from '@/pages/auth';
import { DashboardPage } from '@/pages/dashboard';
import { SubscribersPage } from '@/pages/subscribers';
import { WebhookEditorPage, WebhooksListPage } from '@/pages/webhooks';
import { ReviewsPage } from '@/pages/reviews';
import { ForceTwoFactorSetup, ProfilePage } from '@/pages/profile';
import { RedirectsPage } from '@/pages/redirects';
import { SecurityPage } from '@/pages/security';
import { SeoPage } from '@/pages/seo';
import { SettingsPage } from '@/pages/settings';
import { SnippetsPage } from '@/pages/snippets';
import { SubmissionDetailPage, SubmissionsPage } from '@/pages/submissions';
import { UsersPage } from '@/pages/users';

const BackupsPage = lazy(() => import('@/pages/backups').then((module) => ({ default: module.BackupsPage })));
const CollectionPage = lazy(() => import('@/pages/collections').then((module) => ({ default: module.CollectionPage })));
const MediaPage = lazy(() => import('@/pages/media').then((module) => ({ default: module.MediaPage })));
const BroadcastEditorPage = lazy(() => import('@/pages/broadcasts').then((module) => ({ default: module.BroadcastEditorPage })));
const BroadcastsListPage = lazy(() => import('@/pages/broadcasts').then((module) => ({ default: module.BroadcastsListPage })));
const CampaignEditorPage = lazy(() => import('@/pages/campaigns').then((module) => ({ default: module.CampaignEditorPage })));
const CampaignsListPage = lazy(() => import('@/pages/campaigns').then((module) => ({ default: module.CampaignsListPage })));
const FormEditorPage = lazy(() => import('@/pages/forms').then((module) => ({ default: module.FormEditorPage })));
const FormsListPage = lazy(() => import('@/pages/forms').then((module) => ({ default: module.FormsListPage })));
const PortabilityPage = lazy(() => import('@/pages/portability').then((module) => ({ default: module.PortabilityPage })));
const MenusPage = lazy(() => import('@/pages/menus').then((module) => ({ default: module.MenusPage })));
const PageEditorPage = lazy(() => import('@/pages/pages').then((module) => ({ default: module.PageEditorPage })));
const PagesListPage = lazy(() => import('@/pages/pages').then((module) => ({ default: module.PagesListPage })));
const PostEditorPage = lazy(() => import('@/pages/posts').then((module) => ({ default: module.PostEditorPage })));
const PostsListPage = lazy(() => import('@/pages/posts').then((module) => ({ default: module.PostsListPage })));
const TaxonomyPage = lazy(() => import('@/pages/taxonomy').then((module) => ({ default: module.TaxonomyPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,
      refetchOnWindowFocus: true,
      // Client errors (404, 403, validation) will not fix themselves on retry.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

const adminBase = document.querySelector<HTMLMetaElement>('meta[name="cms-admin-base"]')?.content.replace(/\/+$/, '') || '/admin';

function Guard({ caps, children }: { caps: string[]; children: ReactNode }) {
  const { can } = useAuth();
  if (caps.some((cap) => can(cap))) return <>{children}</>;
  return (
    <EmptyState
      icon={<ShieldAlert />}
      title="You do not have access to this area"
      description="Ask a Super Admin if you need it."
      action={<ButtonLink href="/">Back to the dashboard</ButtonLink>}
    />
  );
}

function NotFound() {
  return <EmptyState title="That admin page does not exist" action={<ButtonLink href="/">Back to the dashboard</ButtonLink>} />;
}

function Protected() {
  return (
    <Shell>
      <Suspense fallback={<PageLoader label="Loading page" />}>
        <Switch>
          <Route path="/"><Guard caps={['dashboard.view']}><DashboardPage /></Guard></Route>
          <Route path="/pages"><Guard caps={['pages.edit']}><PagesListPage /></Guard></Route>
          <Route path="/pages/:id"><Guard caps={['pages.edit']}><PageEditorPage /></Guard></Route>
          <Route path="/posts"><Guard caps={['posts.editOwn', 'posts.editAll']}><PostsListPage /></Guard></Route>
          <Route path="/posts/:id"><Guard caps={['posts.editOwn', 'posts.editAll']}><PostEditorPage /></Guard></Route>
          <Route path="/taxonomy"><Guard caps={['posts.editOwn', 'posts.editAll']}><TaxonomyPage /></Guard></Route>
          <Route path="/collections/:type"><Guard caps={['collections.manage']}><CollectionPage /></Guard></Route>
          <Route path="/media"><Guard caps={['media.upload']}><MediaPage /></Guard></Route>
          <Route path="/menus"><Guard caps={['menus.manage']}><MenusPage /></Guard></Route>
          <Route path="/settings"><Guard caps={['settings.manage']}><SettingsPage /></Guard></Route>
          <Route path="/seo"><Guard caps={['settings.manage']}><SeoPage /></Guard></Route>
          <Route path="/snippets"><Guard caps={['settings.manage']}><SnippetsPage /></Guard></Route>
          <Route path="/security"><Guard caps={['settings.manage']}><SecurityPage /></Guard></Route>
          <Route path="/redirects"><Guard caps={['redirects.manage']}><RedirectsPage /></Guard></Route>
          <Route path="/forms"><Guard caps={['forms.manage']}><FormsListPage /></Guard></Route>
          <Route path="/forms/:id"><Guard caps={['forms.manage']}><FormEditorPage /></Guard></Route>
          <Route path="/campaigns"><Guard caps={['settings.manage']}><CampaignsListPage /></Guard></Route>
          <Route path="/campaigns/:id"><Guard caps={['settings.manage']}><CampaignEditorPage /></Guard></Route>
          <Route path="/subscribers"><Guard caps={['settings.manage']}><SubscribersPage /></Guard></Route>
          <Route path="/broadcasts"><Guard caps={['settings.manage']}><BroadcastsListPage /></Guard></Route>
          <Route path="/broadcasts/:id"><Guard caps={['settings.manage']}><BroadcastEditorPage /></Guard></Route>
          <Route path="/webhooks"><Guard caps={['settings.manage']}><WebhooksListPage /></Guard></Route>
          <Route path="/webhooks/:id"><Guard caps={['settings.manage']}><WebhookEditorPage /></Guard></Route>
          <Route path="/reviews"><Guard caps={['dashboard.view']}><ReviewsPage /></Guard></Route>
          <Route path="/portability"><Guard caps={['content.portability']}><PortabilityPage /></Guard></Route>
          <Route path="/submissions"><Guard caps={['forms.view']}><SubmissionsPage /></Guard></Route>
          <Route path="/submissions/:id"><Guard caps={['forms.view']}><SubmissionDetailPage /></Guard></Route>
          <Route path="/users"><Guard caps={['users.manage']}><UsersPage /></Guard></Route>
          <Route path="/activity"><Guard caps={['activity.view']}><ActivityPage /></Guard></Route>
          <Route path="/backups"><Guard caps={['backups.manage']}><BackupsPage /></Guard></Route>
          <Route path="/profile"><ProfilePage /></Route>
          <Route><NotFound /></Route>
        </Switch>
      </Suspense>
    </Shell>
  );
}

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'];

function Gate() {
  const { user, loading, twoFactorRequired } = useAuth();
  const [location] = useLocation();
  const isPublic = PUBLIC_PATHS.includes(location);

  useEffect(() => {
    document.title = user ? 'Nextract Admin' : 'Sign in · Nextract Admin';
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <PageLoader label="Loading the admin" />
      </div>
    );
  }
  if (!user && !isPublic) return <Redirect to="/login" />;
  if (user && location === '/login') return <Redirect to="/" />;
  // 2FA is required site-wide and this account has not set it up: force it.
  if (user && twoFactorRequired && !user.twoFactorEnabled) return <ForceTwoFactorSetup />;

  return (
    <Switch>
      <Route path="/login"><LoginPage /></Route>
      <Route path="/forgot-password"><ForgotPasswordPage /></Route>
      <Route path="/reset-password"><ResetPasswordPage /></Route>
      <Route><Protected /></Route>
    </Switch>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <Router base={adminBase}>
            <Gate />
          </Router>
          <Toaster position="bottom-right" richColors closeButton />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
