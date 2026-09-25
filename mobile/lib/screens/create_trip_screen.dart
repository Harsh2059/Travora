import 'package:flutter/material.dart';
import 'review_trip_screen.dart';

class CreateTripScreen extends StatefulWidget {
  const CreateTripScreen({super.key});

  @override
  State<CreateTripScreen> createState() => _CreateTripScreenState();
}

class _CreateTripScreenState extends State<CreateTripScreen> {
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _titleController = TextEditingController();
  final List<TextEditingController> _locationControllers = [
    TextEditingController(), // Origin
    TextEditingController(), // Destination
  ];
  DateTime _startDate = DateTime.now().add(const Duration(days: 1));

  @override
  void dispose() {
    _titleController.dispose();
    for (var controller in _locationControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  void _addStop() {
    setState(() {
      _locationControllers.insert(_locationControllers.length - 1, TextEditingController());
    });
  }

  void _removeStop(int index) {
    setState(() {
      _locationControllers[index].dispose();
      _locationControllers.removeAt(index);
    });
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        _startDate = picked;
      });
    }
  }

  void _continue() {
    if (_formKey.currentState!.validate()) {
      final title = _titleController.text.isNotEmpty ? _titleController.text : 'My Journey';
      final locations = _locationControllers.map((c) => c.text.trim()).toList();
      
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => ReviewTripScreen(
            title: title,
            locations: locations,
            startDate: _startDate,
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Plan New Trip'),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Trip Name (Optional)',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 24),
            Text('Itinerary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            SizedBox(height: 16),
            ..._locationControllers.asMap().entries.map((entry) {
              final index = entry.key;
              final controller = entry.value;
              final isOrigin = index == 0;
              final isDest = index == _locationControllers.length - 1;
              String label = 'Stop $index';
              if (isOrigin) label = 'Origin';
              if (isDest) label = 'Destination';

              return Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: controller,
                        decoration: InputDecoration(
                          labelText: label,
                          border: const OutlineInputBorder(),
                          prefixIcon: Icon(isOrigin ? Icons.flight_takeoff : (isDest ? Icons.flight_land : Icons.location_on)),
                        ),
                        validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null,
                      ),
                    ),
                    if (!isOrigin && !isDest)
                      IconButton(
                        icon: Icon(Icons.remove_circle_outline, color: const Color(0xFFDC2626)),
                        onPressed: () => _removeStop(index),
                      ),
                  ],
                ),
              );
            }),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _addStop,
                icon: Icon(Icons.add),
                label: Text('Add Stop'),
              ),
            ),
            SizedBox(height: 24),
            ListTile(
              title: Text('Departure Date'),
              subtitle: Text('${_startDate.day}/${_startDate.month}/${_startDate.year}'),
              trailing: Icon(Icons.calendar_today),
              shape: RoundedRectangleBorder(
                side: BorderSide(color: Colors.grey.shade300),
                borderRadius: BorderRadius.circular(8),
              ),
              onTap: _pickDate,
            ),
            SizedBox(height: 32),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                padding: EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: _continue,
              child: Text('Review Itinerary', style: TextStyle(fontSize: 16)),
            ),
          ],
        ),
      ),
    );
  }
}
