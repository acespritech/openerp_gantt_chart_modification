/*---------------------------------------------------------
 * OpenERP web_gantt
 *---------------------------------------------------------*/
// $(".rightPanel .dataPanel > div.row").last();
openerp.openerp_gantt_chart_modification = function (instance) {
var _t = instance.web._t,
   _lt = instance.web._lt;
var QWeb = instance.web.qweb;

instance.web.ViewManager.include({
   init:function(){
	   instance.web.views.add('gantt', 'instance.openerp_gantt_chart_modification.GanttView')
       this._super.apply(this, arguments);
   } 
});

instance.openerp_gantt_chart_modification.GanttView = instance.web.View.extend({
    display_name: _lt('Gantt'),
    template: "GanttView",
    view_type: "gantt",
    init: function() {
        var self = this;
        this._super.apply(this, arguments);
        this.has_been_loaded = $.Deferred();
        this.chart_id = _.uniqueId();
        this.last_data = null;
        $('a.oe_vm_switch_gantt').click(function() {
            self.open_popup();
        });
        self.open_popup();
    },
    view_loading: function(r) {
        return this.load_gantt(r);
    },
    load_gantt: function(fields_view_get, fields_get) {
        var self = this;
        this.fields_view = fields_view_get;
        this.$el.addClass(this.fields_view.arch.attrs['class']);
        return self.alive(new instance.web.Model(this.dataset.model)
            .call('fields_get')).then(function (fields) {
                self.fields = fields;
                self.has_been_loaded.resolve();
            });
    },
    do_search: function (domains, contexts, group_bys, options) {
        var self = this;
        self.options = options || 'month';
        self.last_domains = domains;
        self.last_contexts = contexts;
        self.last_group_bys = group_bys;
        self.date_start = null;
        self.date_stop = null;
        // select the group by
        var n_group_bys = [];
        if (this.fields_view.arch.attrs.default_group_by) {
            n_group_bys = this.fields_view.arch.attrs.default_group_by.split(',');
        }
        if (group_bys.length) {
            n_group_bys = group_bys;
        }
        // gather the fields to get
        var fields = _.compact(_.map(["date_start", "date_delay", "date_stop"], function(key) {
            self.date_start = self.fields_view.arch.attrs['date_start'];
            self.date_stop = self.fields_view.arch.attrs['date_stop'];
            return self.fields_view.arch.attrs[key] || '';
        }));
        fields = _.uniq(fields.concat(n_group_bys));
        if ($.inArray('user_id', fields) == -1) {
            fields.push('user_id')
        }
        
        // Options wise view loading [Year, Month, Week]
        
        var year = null;
        var month = null;
        var week = null;
        if (self.options == 'all') {
            domains = domains;
        }
        if (self.options == 'year') {
            var domains = [];
            if (self.date_start) {
                domains.push([self.date_start, '>=', (new Date).getFullYear().toString() + '-01-01'])
            }
            if (self.date_stop) {
                domains.push([self.date_stop, '<=', (new Date).getFullYear().toString() + '-12-31'])
            }
        }
        if (self.options == 'month') {
            var domains = [];
            var d = new Date();
            var firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
            var lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            if (self.date_start) {
                domains.push([self.date_start, '>=', (new Date).getFullYear().toString() + '-' + (d.getMonth() + 1) + '-01'])
            }
            if (self.date_stop) {
                domains.push([self.date_stop, '<=', (new Date).getFullYear().toString() + '-' + (d.getMonth() + 1) + '-' + lastDay.getDate()])
            }
        }
        if (self.options == 'week') {
            var domains = [];
            var d = new Date();
            var day = d.getDay();
            var diff = d.getDate() - day + (day == 0 ? -7:0);
            var start = new Date(d.setDate(diff));
            var s_date = (start.getDate()).toString();
            var after_seven = new Date(d.setDate(d.getDate() + 7));
            var e_date = (after_seven.getDate()).toString();
            if (self.date_start) {
                domains.push([self.date_start, '>=', (new Date).getFullYear().toString() + '-' + (start.getMonth() + 1) + '-' + s_date]);
            }
            if (self.date_stop) { 
                domains.push([self.date_stop, '<=', (after_seven.getFullYear()).toString() + '-' + (after_seven.getMonth() + 1) + '-' + e_date])
            }
        }
        return $.when(this.has_been_loaded).then(function() {
            return self.dataset.read_slice(fields, {
                domain: domains,
                context: contexts
            }).then(function(data) {
                if (data.length) {
                    return self.on_data_loaded(data, n_group_bys);
                } else {
                    return alert('No data found...');
                }
            });
        });
    },
    
    // Open popup to select view option.
    
    open_popup: function() {
        var self = this;
        self.dialog = new instance.web.Dialog(self, {
            title: _t("Gantt View Option"),
            width: 320,
            height: 180,
            buttons: [
                {text: _t("Ok"), click: function() { 
                    var gantt_option = self.dialog.$el.find("select.gantt-view-options").val();
                    if (gantt_option) {
                        $(this).dialog('destroy');
                        self.has_been_loaded.resolve();
                        return self.do_search(self.last_domains, self.last_contexts, self.last_group_bys, gantt_option);
                   } else {
                       return;
                   }
                }},
                {text: _t("Cancel"), click: function() { $(this).dialog('destroy'); }}
            ]
        }).open();
        self.dialog.$el.html(QWeb.render("GanttView-Options", self));
    },
    reload: function() {
        if (this.last_domains !== undefined)
            return this.do_search(this.last_domains, this.last_contexts, this.last_group_bys);
    },
    on_data_loaded: function(tasks, group_bys) {
        var self = this;
        var ids = _.pluck(tasks, "id");
        return this.dataset.name_get(ids).then(function(names) {
            var ntasks = _.map(tasks, function(task) {
                return _.extend({__name: _.detect(names, function(name) { return name[0] == task.id; })[1]}, task); 
            });
            return self.on_data_loaded_3(ntasks, group_bys);
        });
    },
    get_element:function(left_check){
       var element = null;
       var left = 0;
       element = _.detect($(".rightPanel .dataPanel > div.row").last().children(), function(xx){
            left = $(xx).offset().left;
            return ( left  <=  left_check && left_check <= left + 24)
       });
       if(element){
           return new Date(parseInt($(element).attr('repdate')));
       }else{
           return this.reload();
       }
    },
    on_data_loaded_3: function(tasks, group_bys){
        var self = this;
        var left_before;
        var render = $(".oe_gantt").gantt({
            source: this.on_data_loaded_2(tasks, group_bys),
            navigate: "scroll",
            itemsPerPage: 55,
            useCookie: false,
            maxScale: "months",
            minScale: this.fields[this.fields_view.arch.attrs.date_start].type == "date" ?"days":"hours",
            onItem: [
            {
                   event: 'resizestart',
                   func: function (e, data) {
                       left_before = $(e.currentTarget).find(".fn-label").offset().left;
                   }
               },
            {
                   event: 'resizestop',
                   func: function (e, data) {
                       var left = $(e.currentTarget).find(".fn-label").offset().left;
                       var date;
                       var data1 = {};
                       if(left_before == left){
                          date = self.get_element( left + $(e.currentTarget).find(".fn-label").width());
                          data1[self.fields_view.arch.attrs.date_stop] = 
                            instance.web.auto_date_to_str(date, self.fields[self.fields_view.arch.attrs.date_stop].type);
                          
                       }else{
                           date = self.get_element(left)
                          data1[self.fields_view.arch.attrs.date_start] =
                            instance.web.auto_date_to_str(date, self.fields[self.fields_view.arch.attrs.date_start].type);
                       }
                       if(date instanceof Date){
                            self.on_task_changed(data.id, data1);
                       }
                   }
               },
               {
                    event: 'click',
                    func: function (e, data) {
                        if(self.last_data){
                           var data1 = {};
                          data1[self.fields_view.arch.attrs.date_stop] = 
                            instance.web.auto_date_to_str(self.last_data['end_date'], self.fields[self.fields_view.arch.attrs.date_stop].type);
                          data1[self.fields_view.arch.attrs.date_start] =
                            instance.web.auto_date_to_str(self.last_data['start_date'], self.fields[self.fields_view.arch.attrs.date_start].type);
                           self.on_task_changed(data.id, data1);
                           self.last_data = false;
                        }else{
                            if(!isNaN(data.id)){
                                self.on_task_display(data.id)
                            }
                        }
                    }
                },
            ],
            onItemClick: function(data) {
                
            },
            onAddClick: function(dt, rowId) {
                self.on_task_create();
            },
            onRender: function() {
                if (window.console && typeof console.log === "function") {
                    self.set_draggable();
                    self.set_resiable();
                }
            },
        });
    },
    // Resize events/tasks
    set_resiable: function(){
        var self = this;
        $( ".move_this" ).resizable({ ghost: true,
                            grid: [24, 24],
                            minHeight: 18,
                            maxHeight: 18,
                            handles: "e,w",
                            minWidth: 24
                        });
    },
    // Drang and drop events/tasks
    set_draggable: function(){
            var self = this;
            var element;
            $('.move_this').draggable({
                axis: 'x',
                grid: [24, 24],
                drag: function( event, ui ) {
                    var dom = document.elementFromPoint(event.clientX, event.clientY)
                    if($(dom).hasClass('fn-label'))element = dom;
                },
                stop:function(event, ui){
                    if(element){
                        var left = $(element).offset().left;
                        var start_date = self.get_element(left);
                        var stop_date = self.get_element(left + $(element).width());
                        if(start_date instanceof Date && stop_date instanceof Date){
                            self.last_data = {
                                start_date:start_date,
                                end_date:stop_date
                            }
                        }else{
                            self.last_data = false;
                        }
                    }
                }
            });
    },
    on_data_loaded_2: function(tasks, group_bys) {
        var self = this;
        //prevent more that 1 group by
        if (group_bys.length > 0) {
            group_bys = [group_bys[0]];
        }
        // if there is no group by, simulate it
        if (group_bys.length == 0) {
            group_bys = ["_pseudo_group_by"];
            _.each(tasks, function(el) {
                el._pseudo_group_by = "Gantt View";
            });
            this.fields._pseudo_group_by = {type: "string"};
        }
        
        // get the groups
        var split_groups = function(tasks, group_bys) {
            if (group_bys.length === 0)
                return tasks;
            var groups = [];
            _.each(tasks, function(task) {
                var group_name = task[_.first(group_bys)];
                var group = _.find(groups, function(group) { return _.isEqual(group.name, group_name); });
                if (group === undefined) {
                    group = {name:group_name, tasks: [], __is_group: true};
                    groups.push(group);
                }
                group.tasks.push(task);
            });
            _.each(groups, function(group) {
                group.tasks = split_groups(group.tasks, _.rest(group_bys));
            });
            return groups;
        }
        var groups = split_groups(tasks, group_bys);
        // track ids of task items for context menu
        var task_ids = {};
        var assign_to = [];
        // creation of the chart
        var generate_task_info = function(task, plevel) {
            var level = plevel || 0;
            if (task.__is_group) {
                assign_to = task.user_id;
                var task_infos = _.compact(_.map(task.tasks, function(sub_task) {
                    return generate_task_info(sub_task, level + 1);
                }));
                if (task_infos.length == 0)
                    return;
                var task_start = _.reduce(_.pluck(task_infos, "task_start"), function(date, memo) {
                    return memo === undefined || date < memo ? date : memo;
                }, undefined);
                var task_stop = _.reduce(_.pluck(task_infos, "task_stop"), function(date, memo) {
                    return memo === undefined || date > memo ? date : memo;
                }, undefined);
                var group_name = instance.web.format_value(task.name, self.fields[group_bys[level]]);
                return {id:task.id, child_task:task_infos, task_start: task_start, task_stop: task_stop,task_name:group_name,level:level,assign_to:assign_to};
            } else {
                assign_to = task.user_id;
                var task_name = task.__name;
                var task_start = instance.web.auto_str_to_date(task[self.fields_view.arch.attrs.date_start]);
                if (!task_start)
                    return;
                var task_stop;
                if (self.fields_view.arch.attrs.date_stop) {
                    task_stop = instance.web.auto_str_to_date(task[self.fields_view.arch.attrs.date_stop]);
                    if (!task_stop)
                        return;
                } else { // we assume date_duration is defined
                    var tmp = instance.web.format_value(task[self.fields_view.arch.attrs.date_delay],
                        self.fields[self.fields_view.arch.attrs.date_delay]);
                    if (!tmp)
                        return;
                    task_stop = task_start.clone().addMilliseconds(tmp * 60 * 60 * 1000);
                }
                return {id:task.id, task_name: task_name, task_start: task_start, task_stop: task_stop, level:level,assign_to:assign_to};
            }
        }
        
        var final_data = [];
        var prepare_final_data = function(project, task_project, key){
            var def = _.str.sprintf("/Date(%s)/", task_project['task_stop'].getTime())
            final_data.push({
                name: task_project['level']?' ':project['task_name'],
                desc: task_project['task_name'],
                values:[{
                    id: task_project.id ? task_project.id : "project_" + key,
                    from: _.str.sprintf("/Date(%s)/", task_project['task_start'].getTime()),
                    to: _.str.sprintf("/Date(%s)/", task_project['task_stop'].getTime()),
                    label: task_project['task_name'], 
                    customClass: get_color(task_project.id, task_project.assign_to),
                    dataObj:{
                            id: task_project.id ? task_project.id : "project_" + key,
                            start_date: task_project['task_start'],
                            stop_date:task_project['task_stop'],
                            assign_to: assign_to
                        }
                    }]
            });
            
            _.each(task_project['child_task'],function(task){
                prepare_final_data(project, task, key)
            });
        }
        // Color based on conditions
        var get_color = function(id, assign_to) {
            if (id) {
                if (! assign_to) {
                    return "move_this ganttDarkRed";
                } else {
                    return "move_this ganttRed";
                }
            } else {
                return "ganttOrange";
            }
            
        }
        var projects = _.compact(_.map(groups, function(e) {return generate_task_info(e, 0);}))
        _.each(projects, function(value, key) {
            prepare_final_data(value, value, key);
        });
        self.projects = projects;
        return final_data;
    },
    on_task_changed: function(id, data) {
        var self = this;
        return this.dataset.write(id, data);
    },
    // Popup to edit existing task
    on_task_display: function(id) {
        var self = this;
        var pop = new instance.web.form.FormOpenPopup(self);
        pop.on('write_completed',self,self.reload);
        pop.show_element(
            self.dataset.model,
            id,
            null,
            {}
        );
    },
    // Open popup to create new task
    on_task_create: function(res_id) {
        var self = this;
        var pop = new instance.web.form.SelectCreatePopup(this);
        pop.on("elements_selected", self, function() {
            self.reload();
        });
        pop.select_element(
            self.dataset.model,
            {
                res_id:res_id,
                initial_view: "form",
            }
        );
    },
});

};
