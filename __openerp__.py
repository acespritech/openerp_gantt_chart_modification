{
    'name': 'Web Gantt',
    'category': 'Hidden',
    'description': """
OpenERP Web Gantt chart view.Using jquery gantt chart.
=============================

""",
    'version': '2.0',
    'depends': ['web'],
    'author': "Acespritech Solutions Pvt. Ltd.",
    'website': 'www.acespritech.com',
    'js': [
        'static/lib/jquery.fn.gantt.js',
        'static/src/js/web_gantt_chart.js'
    ],
    'css': ['static/src/css/*.css'],
    'qweb': [
        'static/src/xml/*.xml',
    ],
    'auto_install': False,
    'installable': True
    
}
