// TEMP smoke-test entry — bundles the changed pages + their whole import subgraph.
import { RequestForm } from './src/pages/RequestForm.tsx';
import { RequestDetail } from './src/pages/RequestDetail.tsx';
import { Requests } from './src/pages/Requests.tsx';
import { RequestsReview } from './src/pages/RequestsReview.tsx';
import { Sidebar } from './src/components/Sidebar.tsx';
import { Dashboard } from './src/pages/Dashboard.tsx';
export const _smoke = [RequestForm, RequestDetail, Requests, RequestsReview, Sidebar, Dashboard];
