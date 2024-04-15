import fiftyone.operators as foo
import json
from bson import json_util


def serialize_view(view):
    return json.loads(json_util.dumps(view._serialize()))


class E2ESetView(foo.Operator):
    @property
    def config(self):
        return foo.OperatorConfig(
            name="e2e_set_view",
            label="E2E: Set view",
        )

    def execute(self, ctx):
        view = ctx.dataset.limit(3)
        ctx.trigger("set_view", {"view": serialize_view(view)})
        return {}


class E2ERegisterMarkdownPanel(foo.Operator):
    @property
    def config(self):
        return foo.OperatorConfig(
            name="e2e_register_markdown_panel",
            label="E2E: Register markdown panel",
            unlisted=True,
            on_startup=True,
        )

    def execute(self, ctx):
        ctx.ops.register_panel(
            "e2e_markdown_panel",
            "E2E: Markdown panel",
            on_load="@voxel51/e2e/e2e_render_markdown_panel",
            on_change="@voxel51/e2e/e2e_markdown_panel_on_change",
        )
        return {}


class E2ERenderMarkdownPanel(foo.Operator):
    @property
    def config(self):
        return foo.OperatorConfig(
            name="e2e_render_markdown_panel",
            label="E2E: Render markdown panel",
            unlisted=True,
        )

    def execute(self, ctx):
        schema = foo.types.Object()
        schema.str("name")
        schema.str("md", view=foo.types.MarkdownView())
        ctx.ops.set_panel_state({"md": "Hi Anonymous!"})
        ctx.ops.show_panel_output(foo.types.Property(schema))
        return {}


class E2EMarkdownPanelOnChange(foo.Operator):
    @property
    def config(self):
        return foo.OperatorConfig(
            name="e2e_markdown_panel_on_change",
            label="E2E: Markdown panel on change",
            unlisted=True,
        )

    def execute(self, ctx):
        panel_state = ctx.params.get("panel_state", {})
        name = panel_state.get("name", "Anonymous")
        panel_state["md"] = f"Hi {name}!"
        ctx.ops.set_panel_state(panel_state)
        return {}


def register(p):
    p.register(E2ESetView)
    p.register(E2ERegisterMarkdownPanel)
    p.register(E2ERenderMarkdownPanel)
    p.register(E2EMarkdownPanelOnChange)
