"""
FiftyOne Teams types.

| Copyright 2017-2022, Voxel51, Inc.
| `voxel51.com <https://voxel51.com/>`_
|
"""
import typing as t

from bson import ObjectId
import strawberry as gql

from .context import Info
from .interfaces import Stage


ID = gql.scalar(
    t.NewType("ID", str),
    serialize=lambda v: str(v),
    parse_value=lambda v: ObjectId(v),
)


@gql.type
class SelectedLabelData:
    id: str
    sample_id: str
    field: str
    frame_number: t.Optional[int]


@gql.type
class Session:
    dataset: t.Optional[str]
    view: t.Optional[t.List[Stage]]
    selected: t.Optional[t.List[str]]
    selected_labels: t.Optional[t.List[SelectedLabelData]]
    user_id: gql.ID


@gql.type
class User:
    id: gql.ID


@gql.type
class Query:
    users: t.List[User]

    @gql.field
    def viewer(self, info: Info) -> User:
        return User(id=ObjectId("000000000000000000000000"))
