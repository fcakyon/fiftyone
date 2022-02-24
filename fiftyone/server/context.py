"""
FiftyOne Server context

| Copyright 2017-2022, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""
import typing as t

import motor as mtr
import starlette.requests as strq
import starlette.responses as strp
import strawberry.asgi as gqla


import fiftyone as fo
import fiftyone.constants as foc

from .dataclasses import Context
from .dataloader import dataloaders, get_dataloader


class GraphQL(gqla.GraphQL):
    async def get_context(
        self,
        request: strq.Request,
        response: t.Optional[strp.Response] = None,
    ) -> Context:
        db_client = mtr.MotorClient(fo.config.database_uri)
        db = db_client[foc.DEFAULT_DATABASE]
        session = await db_client.start_session()
        loaders = {}
        for cls, config in dataloaders.items():
            loaders[cls] = get_dataloader(cls, config, db, session)

        return Context(db=db, session=session, dataloaders=loaders,)
