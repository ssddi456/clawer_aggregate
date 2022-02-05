require(["vue", "underscore", "ace/ace"], function (vue, _, ace) {
    ace.config.set("packaged", true);
    ace.config.set("basePath", require.toUrl("ace"));

    var mainVm = new vue({
        el: "#main",
        data: {
            url: "https://kmcha.com/similar/%E5%A4%A7%E8%84%91",
            extract_options: `{
    "similars": ["text", "#similar-words + p"]
}`,
            extract_options_json: "",
            aceResEditor: undefined,
        },
        methods: {
            onUrlChange: _.debounce(function () {
                return fetch("/download", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        url: this.url,
                    }),
                });
            }),
            onExtractOptionsChange: _.debounce(function () {
                return fetch("/extract_object", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        url: this.url,
                        unpack_options: this.extract_options,
                    }),
                })
                    .then((r) => r.text())
                    .then((r) => {
                        this.extract_options_json = r;
                        this.aceResEditor.getSession().setValue(r);
                    });
            }),
            refresh: function (e) {
                this.onUrlChange();
                setTimeout(() => {
                    this.onExtractOptionsChange();
                }, 3000);
            },
        },
        watch: {
            url: function () {
                this.refresh();
            },
            extract_options: function () {
                this.refresh();
            },
        },
        mounted: function () {
            var jeEditCode = "aceEditorCode";
            var jeEditRes = "aceEditorRes";
            var aceCodeEditor = createEditor(jeEditCode, {
                mode: "ace/mode/json",
                wrap: true,
                useWrapMode: true,
                indentedSoftWrap: true,
            });
            aceCodeEditor.getSession().setValue(this.extract_options);
            aceCodeEditor.getSession().on("change", function () {
                this.extract_options = aceCodeEditor.getSession().getValue();
            });
            var aceResEditor = createEditor(jeEditRes, {
                mode: "ace/mode/json",
                wrap: true,
                useWrapMode: true,
                indentedSoftWrap: true,
                readOnly: true,
            });
            this.aceResEditor = aceResEditor;
        },
        template: /*html*/ `

<div class="container">
    <form>
        <div class="form-group">
            <label for="exampleInputEmail1">Email address</label>
            <div class="input-group">
                <input type="url" class="form-control" v-model="url">
                <div class="input-group-append">
                    <button @click.prevent="refresh" class="btn btn-primary">refresh</button>
                </div>
            </div>
        </div>
        <div class="form-group">
            <label for="exampleInputPassword1">config</label>
            <div id="aceEditorCode"></div>
        </div>
        <div class="form-group">
            <label for="exampleInputPassword1">res</label>
            <div id="aceEditorRes"></div>
        </div>
    </form>
</div>

        `,
    });

    function createEditor(el, options) {
        var replaceCmd = {
            name: "replace",
            bindKey: { win: "Ctrl-R", mac: "Command-Option-F" },
            exec: function (editor) {
                window.ace.config.loadModule("ace/ext/searchbox", function (e) {
                    e.Search(editor, true);
                });
            },
            readOnly: true,
        };
        var ed = ace.edit(el);

        ed.setOptions({ theme: "ace/theme/monokai" });
        ed.session.setOptions({
            tabSize: 2,
            useSoftTabs: true,
            ...options,
        });
        ed.renderer.setOptions({ minLines: 40, maxLines: 40 });
        // Change replace shortcut from Ctrl-H to Ctrl-R
        ed.commands.addCommand(replaceCmd);

        return ed;
    }
});
