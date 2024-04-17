import React, { FC } from 'react';

import { RouteModel } from '@kubevirt-ui/kubevirt-api/console';
import { ResourceYAMLEditor, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  PageSection,
  PageSectionVariants,
  Text,
  TextVariants,
  Title,
} from '@patternfly/react-core';
import { EditorType } from '@utils/components/SyncedEditor/EditorToggle';
import { SyncedEditor } from '@utils/components/SyncedEditor/SyncedEditor';
import { safeYAMLToJS } from '@utils/components/SyncedEditor/yaml';
import { useNetworkingTranslation } from '@utils/hooks/useNetworkingTranslation';
import { getValidNamespace } from '@utils/utils';
import { LAST_VIEWED_EDITOR_TYPE_USERSETTING_KEY } from '@views/networkpolicies/new/utils/const';

import RouteForm from './RouteForm';
import { generateDefaultRoute } from './utils';

const RouteFormPage: FC = () => {
  const { t } = useNetworkingTranslation();

  const [activeNamespace] = useActiveNamespace();
  const namespace = getValidNamespace(activeNamespace);

  const k8sObj = generateDefaultRoute(namespace);

  return (
    <>
      <PageSection variant={PageSectionVariants.light}>
        <Title headingLevel="h2">{t('Create {{label}}', { label: RouteModel.label })}</Title>
        <Text component={TextVariants.p}>
          {t('Routing is a way to make your application publicly visible')}
        </Text>
      </PageSection>

      <SyncedEditor
        displayConversionError
        FormEditor={RouteForm}
        initialData={k8sObj}
        initialType={EditorType.Form}
        lastViewUserSettingKey={LAST_VIEWED_EDITOR_TYPE_USERSETTING_KEY}
        YAMLEditor={({ initialYAML = '', onChange }) => (
          <ResourceYAMLEditor
            create
            hideHeader
            initialResource={safeYAMLToJS(initialYAML)}
            onChange={onChange}
          />
        )}
      />
    </>
  );
};

export default RouteFormPage;
