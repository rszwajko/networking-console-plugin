import React from 'react';
import { http, HttpResponse } from 'msw';
import { settle } from 'src/__mocks__/integration/act';
import { consoleApiPath, mockGet, mockList } from 'src/__mocks__/integration/api';
import { setAccessReview } from 'src/__mocks__/integration/dynamic-plugin-sdk';
import recordedMultus from 'src/__mocks__/integration/recordings/multus-daemon-config.json' with { type: 'json' };
import recordedNads from 'src/__mocks__/integration/recordings/nads.json' with { type: 'json' };
import recordedNamespace from 'src/__mocks__/integration/recordings/namespace.json' with { type: 'json' };
import recordedNamespaceWithSettings from 'src/__mocks__/integration/recordings/namespace-with-settings.json' with { type: 'json' };
import { server } from 'src/__mocks__/integration/server';

import { describe, expect, it } from '@jest/globals';
import { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PROJECT_DEFAULT_NETWORK_ANNOTATION } from '@utils/resources/nads/constants';

import ProjectNetworkSettingsTab from './ProjectNetworkSettingsTab';

const PROJECT = recordedNamespace.metadata.name;
const MULTUS = consoleApiPath('', 'v1', 'configmaps', 'openshift-multus');
const NADS = (namespace: string) =>
  consoleApiPath('k8s.cni.cncf.io', 'v1', 'network-attachment-definitions', namespace);
const NAMESPACES = consoleApiPath('', 'v1', 'namespaces');

const nadsIn = (namespace: string) =>
  recordedNads.items.filter((nad) => nad.metadata.namespace === namespace);

const mockCluster = () => {
  mockGet(`${MULTUS}/multus-daemon-config`, recordedMultus);
  mockList(NADS(PROJECT), nadsIn(PROJECT));
  mockList(NADS('default'), nadsIn('default'));
};

const renderTab = async (obj: K8sResourceCommon = recordedNamespace as K8sResourceCommon) => {
  render(<ProjectNetworkSettingsTab obj={obj} />);
  // Multus config → NAD access reviews → NAD lists: flush a few microtask turns.
  await settle();
  await settle();
  await settle();
};

const getNetworkInput = () => screen.getByRole('combobox') as HTMLInputElement;

const openNetworkSelect = async () => {
  fireEvent.click(getNetworkInput());
  await settle();
};

const expectNetworkValue = (value: string) => {
  expect(getNetworkInput().value).toBe(value);
};

describe('ProjectNetworkSettingsTab over the recorded console API payloads', () => {
  it('renders the network settings form with Pod network pre-selected by default', async () => {
    mockCluster();
    await renderTab();

    expect(await screen.findByRole('heading', { name: 'Network Settings' })).toBeTruthy();
    expect((screen.getByLabelText('Show Pod network option') as HTMLInputElement).checked).toBe(
      true,
    );
    expectNetworkValue('Pod network');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('lists project and global NetworkAttachmentDefinitions in the select', async () => {
    mockCluster();
    await renderTab();
    await openNetworkSelect();

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Pod network' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'local-bridge' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'secondary-net' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'default/shared-bridge' })).toBeTruthy();
    // Primary UDN NADs are filtered out of the pre-selected network options.
    expect(within(listbox).queryByRole('option', { name: 'primary-udn' })).toBeNull();
  });

  it('loads annotations from the recorded namespace with settings', async () => {
    mockCluster();
    await renderTab(recordedNamespaceWithSettings as K8sResourceCommon);

    expect((screen.getByLabelText('Show Pod network option') as HTMLInputElement).checked).toBe(
      false,
    );
    expectNetworkValue('local-bridge');
  });

  it('shows the read-only alert when the user cannot patch the namespace', async () => {
    setAccessReview([false, false], {
      name: PROJECT,
      resource: 'namespaces',
      verb: 'patch',
    });
    mockCluster();
    await renderTab();

    expect(await screen.findByText('Read-only')).toBeTruthy();
    expect(
      screen.getByText('Patch permission is required to edit project network settings.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  });

  it('enables Save after the Pod network switch is toggled, and Cancel restores it', async () => {
    mockCluster();
    await renderTab();

    const toggle = screen.getByLabelText('Show Pod network option') as HTMLInputElement;
    fireEvent.click(toggle);
    await settle();

    expect(toggle.checked).toBe(false);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();

    expect((screen.getByLabelText('Show Pod network option') as HTMLInputElement).checked).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('clears then restores Pod network as the pre-selected network when Show Pod is toggled', async () => {
    mockCluster();
    // recordedNamespace has no kubevirt network-settings annotations.
    await renderTab();

    expect((screen.getByLabelText('Show Pod network option') as HTMLInputElement).checked).toBe(
      true,
    );
    expectNetworkValue('Pod network');

    const toggle = screen.getByLabelText('Show Pod network option') as HTMLInputElement;
    fireEvent.click(toggle);
    await settle();

    expect(toggle.checked).toBe(false);
    expectNetworkValue('');

    fireEvent.click(toggle);
    await settle();

    expect(toggle.checked).toBe(true);
    expectNetworkValue('Pod network');
  });

  it('shows Clear when a network is selected, and Clear empties the selection', async () => {
    mockCluster();
    await renderTab();

    await openNetworkSelect();
    fireEvent.click(await screen.findByRole('option', { name: 'local-bridge' }));
    await settle();

    expectNetworkValue('local-bridge');
    const clear = screen.getByLabelText('Clear input value');
    expect(clear).toBeTruthy();

    fireEvent.click(clear);
    await settle();

    expectNetworkValue('');
    expect(screen.queryByLabelText('Clear input value')).toBeNull();
  });

  it('PATCHes the namespace when Save is clicked after selecting a NAD', async () => {
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

    mockCluster();
    await renderTab();
    await openNetworkSelect();
    fireEvent.click(await screen.findByRole('option', { name: 'local-bridge' }));
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

  it('shows a warning when a namespace NAD list fails to load', async () => {
    mockGet(`${MULTUS}/multus-daemon-config`, recordedMultus);
    mockList(NADS(PROJECT), nadsIn(PROJECT));
    server.use(
      http.get(NADS('default'), () => HttpResponse.json({ message: 'forbidden' }, { status: 403 })),
    );

    await renderTab();

    expect(await screen.findByText('Incomplete network attachment definitions')).toBeTruthy();
    expect(
      screen.getByText('Failed to load network attachment definitions from namespaces:'),
    ).toBeTruthy();
    expect(screen.getByText('default')).toBeTruthy();

    // NADs from namespaces that loaded successfully remain selectable.
    await openNetworkSelect();
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByRole('option', { name: 'Pod network' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'local-bridge' })).toBeTruthy();
    expect(within(listbox).getByRole('option', { name: 'secondary-net' })).toBeTruthy();
    expect(within(listbox).queryByRole('option', { name: 'default/shared-bridge' })).toBeNull();
  });

  it('shows a concurrent-change warning when watched settings diverge from the local baseline', async () => {
    mockCluster();
    const { rerender } = render(
      <ProjectNetworkSettingsTab obj={recordedNamespace as K8sResourceCommon} />,
    );
    await settle();
    await settle();
    await settle();

    expectNetworkValue('Pod network');

    rerender(
      <ProjectNetworkSettingsTab obj={recordedNamespaceWithSettings as K8sResourceCommon} />,
    );
    await settle();

    expect(await screen.findByText('Network settings changed')).toBeTruthy();
    expect(screen.getByText('Network settings have been changed in the background')).toBeTruthy();
    // Form values are not auto-overwritten; Cancel resets to the new baseline.
    expect((screen.getByLabelText('Show Pod network option') as HTMLInputElement).checked).toBe(
      true,
    );
    expectNetworkValue('Pod network');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();

    expect((screen.getByLabelText('Show Pod network option') as HTMLInputElement).checked).toBe(
      false,
    );
    expectNetworkValue('local-bridge');
    expect(screen.queryByText('Network settings changed')).toBeNull();
  });
});
