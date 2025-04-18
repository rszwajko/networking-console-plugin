import React, { FC } from 'react';
import { Link } from 'react-router-dom-v5-compat';

import { modelToRef, RouteModel } from '@kubevirt-ui/kubevirt-api/console';
import { Breadcrumb, BreadcrumbItem, Title } from '@patternfly/react-core';
import DetailsPageTitle from '@utils/components/DetailsPageTitle/DetailsPageTitle';
import PaneHeading from '@utils/components/PaneHeading/PaneHeading';
import { useLastNamespacePath } from '@utils/hooks/useLastNamespacePath';
import { useNetworkingTranslation } from '@utils/hooks/useNetworkingTranslation';
import { getName } from '@utils/resources/shared';
import { RouteKind } from '@utils/types';
import RouteActions from '@views/routes/actions/RouteActions';

type RouteDetailsPageTitleProps = {
  route: RouteKind;
};

const RouteDetailsPageTitle: FC<RouteDetailsPageTitleProps> = ({ route }) => {
  const { t } = useNetworkingTranslation();
  const namespacePath = useLastNamespacePath();

  return (
    <DetailsPageTitle
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to={`/k8s/${namespacePath}/${modelToRef(RouteModel)}`}>{t('Routes')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem>{t('Route details')}</BreadcrumbItem>
        </Breadcrumb>
      }
    >
      <PaneHeading>
        <Title headingLevel="h1">
          <span
            className="co-m-resource-icon co-m-resource-service co-m-resource-icon--lg"
            title="Route"
          >
            {t('RT')}
          </span>
          {getName(route)}
        </Title>
        <RouteActions route={route} />
      </PaneHeading>
    </DetailsPageTitle>
  );
};

export default RouteDetailsPageTitle;
