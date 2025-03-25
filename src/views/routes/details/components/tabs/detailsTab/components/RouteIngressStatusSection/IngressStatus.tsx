import React, { FC } from 'react';

import { Title as PFTitle } from '@patternfly/react-core';
import { DetailsItem } from '@utils/components/DetailsItem/DetailsItem';
import Title from '@utils/components/Title/Title';
import { useNetworkingTranslation } from '@utils/hooks/useNetworkingTranslation';
import { RouteIngress, RouteKind } from '@utils/types';
import CustomRouteHelp from '@views/routes/details/components/tabs/detailsTab/components/RouteDetailsSection/CustomRouteHelp';
import Conditions from '@views/routes/details/components/tabs/detailsTab/components/RouteIngressStatusSection/Conditions';
import { showCustomRouteHelp } from '@views/routes/details/utils/utils';

type IngressStatusProps = {
  ingress: RouteIngress;
  route: RouteKind;
};

const IngressStatus: FC<IngressStatusProps> = ({ ingress, route }) => {
  const { t } = useNetworkingTranslation();

  return (
    <div className="co-m-route-ingress-status" key={ingress?.routerName}>
      <Title
        titleText={`${t('Router: {{routerName}}', {
          routerName: ingress?.routerName,
        })}`}
      />
      <dl>
        <DetailsItem label={t('Host')} obj={route} path="status.ingress.host">
          {ingress?.host}
        </DetailsItem>
        <DetailsItem label={t('Wildcard policy')} obj={route} path="status.ingress.wildcardPolicy">
          {ingress?.wildcardPolicy}
        </DetailsItem>
        <DetailsItem
          label={t('Router canonical hostname')}
          obj={route}
          path="status.ingress.routerCanonicalHostname"
        >
          <div>{ingress?.routerCanonicalHostname || '-'}</div>
          {showCustomRouteHelp(ingress, route.metadata.annotations) && (
            <CustomRouteHelp
              host={ingress?.host}
              routerCanonicalHostname={ingress?.routerCanonicalHostname}
            />
          )}
        </DetailsItem>
      </dl>
      <PFTitle className="pf-v6-u-my-lg" headingLevel="h3">
        {t('Conditions')}
      </PFTitle>
      <Conditions conditions={ingress?.conditions} />
    </div>
  );
};

export default IngressStatus;
