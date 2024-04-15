import React, { FC } from 'react';

import { IoK8sApiNetworkingV1Ingress } from '@kubevirt-ui/kubevirt-api/kubernetes/models';
import Title from '@utils/components/Title/Title';
import { useNetworkingTranslation } from '@utils/hooks/useNetworkingTranslation';
import { getNamespace } from '@utils/resources/shared';
import RulesHeader from '@views/ingresses/details/tabs/details/components/IngressRulesSection/RulesHeader';
import RulesRows from '@views/ingresses/details/tabs/details/components/IngressRulesSection/RulesRows';

type IngressRulesSectionProps = {
  ingress: IoK8sApiNetworkingV1Ingress;
};

const IngressRulesSection: FC<IngressRulesSectionProps> = ({ ingress }) => {
  const { t } = useNetworkingTranslation();

  return (
    <>
      <Title titleText={t('Ingress rules')} />
      <p className="co-m-pane__explanation">
        {t(
          'These rules are handled by a routing layer (Ingress Controller) which is updated as the rules are modified. The Ingress controller implementation defines how headers and other metadata are forwarded or manipulated',
        )}
      </p>
      <div className="co-m-table-grid co-m-table-grid--bordered">
        <RulesHeader />
        <RulesRows namespace={getNamespace(ingress)} spec={ingress?.spec} />
      </div>
    </>
  );
};

export default IngressRulesSection;
