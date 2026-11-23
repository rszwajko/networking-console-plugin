import React from 'react';
import { http, HttpResponse } from 'msw';
import { settle } from 'src/__mocks__/integration/act';
import { consoleApiPath, mockGet, mockList } from 'src/__mocks__/integration/api';
import { setAccessReview } from 'src/__mocks__/integration/dynamic-plugin-sdk';
import recordedMultus from 'src/__mocks__/integration/recordings/multus-daemon-config.json' with { type: 'json' };
import recordedNads from 'src/__mocks__/integration/recordings/nads.json' with { type: 'json' };
import recordedNamespace from 'src/__mocks__/integration/recordings/namespace.json' with { type: 'json' };
import { server } from 'src/__mocks__/integration/server';

import { describe, expect, it } from '@jest/globals';
import { NetworkAttachmentDefinitionModel } from '@kubevirt-ui-ext/kubevirt-api/console';
import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  GLOBAL_NAD_NAMESPACES,
  MULTUS_DAEMON_CONFIG_NAME,
  OPENSHIFT_MULTUS_NS,
  PROJECT_DEFAULT_NETWORK_ANNOTATION,
} from '@utils/resources/nads/constants';

import ProjectNetworkSettingsTab from './ProjectNetworkSettingsTab';

const PROJECT = recordedNamespace.metadata.name;
const MULTUS = consoleApiPath('', 'v1', 'configmaps', 'openshift-multus');
const NADS = (namespace: string) =>
  consoleApiPath('k8s.cni.cncf.io', 'v1', 'network-attachment-definitions', namespace);
const NAMESPACES = consoleApiPath('', 'v1', 'namespaces');

const TEST_IMPERSONATE = {
  kind: 'User',
  name: 'test',
  subprotocols: ['Impersonate-User.dGVzdA__'],
};

const nadsIn = (namespace: string) =>
  recordedNads.items.filter((nad) => nad.metadata.namespace === namespace);

const mockCluster = () => {
  mockGet(`${MULTUS}/multus-daemon-config`, recordedMultus);
  mockList(NADS(PROJECT), nadsIn(PROJECT));
  // GLOBAL_NAD_NAMESPACES fallback watches these; seed empty lists except default.
  for (const namespace of GLOBAL_NAD_NAMESPACES) {
    mockList(NADS(namespace), nadsIn(namespace));
  }
};

const flushWatches = async () => {
  await settle();
  await settle();
  await settle();
};

const getNetworkInput = () => screen.getByRole('combobox') as HTMLInputElement;

const openNetworkSelect = async () => {
  fireEvent.click(getNetworkInput());
  await settle();
};

const closeNetworkSelect = async () => {
  fireEvent.click(getNetworkInput());
  await settle();
};

/** Deny Multus daemon-config reads for the impersonated user; leave namespace patch allowed. */
const denyMultusForImpersonate = (impersonate: typeof TEST_IMPERSONATE) => {
  setAccessReview(
    [false, false],
    {
      name: MULTUS_DAEMON_CONFIG_NAME,
      namespace: OPENSHIFT_MULTUS_NS,
      resource: 'configmaps',
      verb: 'get',
    },
    impersonate,
  );
  setAccessReview(
    [true, false],
    {
      name: PROJECT,
      resource: 'namespaces',
      verb: 'patch',
    },
    impersonate,
  );
};

describe('ProjectNetworkSettingsTab impersonation', () => {
  it('falls back to GLOBAL_NAD_NAMESPACES when Multus is denied, and can save a project NAD', async () => {
    mockCluster();
    const { rerender } = render(
      <ProjectNetworkSettingsTab obj={recordedNamespace as K8sResourceCommon} />,
    );
    await flushWatches();

    // Regular user: project + Multus globalNamespace NADs are listed.
    await openNetworkSelect();
    let listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Pod network' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'local-bridge' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'secondary-net' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'default/shared-bridge' })).toBeTruthy();
    // Close the menu before re-rendering as the impersonated user.
    await closeNetworkSelect();

    denyMultusForImpersonate(TEST_IMPERSONATE);
    rerender(
      <ProjectNetworkSettingsTab
        impersonate={TEST_IMPERSONATE}
        obj={recordedNamespace as K8sResourceCommon}
      />,
    );
    await flushWatches();

    // Without Multus config access, useGlobalNamespaces falls back to GLOBAL_NAD_NAMESPACES
    // (still filtered by per-namespace NAD list access), so default/shared-bridge remains.
    await openNetworkSelect();
    listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Pod network' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'local-bridge' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'secondary-net' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'default/shared-bridge' })).toBeTruthy();

    const patches: unknown[] = [];
    server.use(
      http.patch(`${NAMESPACES}/:name`, async ({ request }) => {
        patches.push(await request.json());
        return HttpResponse.json({
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: {
            annotations: {
              [PROJECT_DEFAULT_NETWORK_ANNOTATION]: 'local-bridge',
            },
            name: PROJECT,
          },
        });
      }),
    );

    fireEvent.click(within(listbox).getByRole('option', { name: 'local-bridge' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await settle();

    await waitFor(() => expect(patches.length).toBe(1));
    expect(patches[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          op: 'add',
          path: '/metadata/annotations/kubevirt.io~1default-network',
          value: 'local-bridge',
        }),
      ]),
    );
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides a fallback global namespace when NAD list access is denied under impersonation', async () => {
    mockCluster();
    denyMultusForImpersonate(TEST_IMPERSONATE);
    setAccessReview(
      [false, false],
      {
        group: NetworkAttachmentDefinitionModel.apiGroup,
        namespace: 'default',
        resource: NetworkAttachmentDefinitionModel.plural,
        verb: 'list',
      },
      TEST_IMPERSONATE,
    );

    render(
      <ProjectNetworkSettingsTab
        impersonate={TEST_IMPERSONATE}
        obj={recordedNamespace as K8sResourceCommon}
      />,
    );
    await flushWatches();

    await openNetworkSelect();
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'local-bridge' })).toBeTruthy();
    expect(within(listbox).queryByRole('option', { name: 'default/shared-bridge' })).toBeNull();
  });
});
